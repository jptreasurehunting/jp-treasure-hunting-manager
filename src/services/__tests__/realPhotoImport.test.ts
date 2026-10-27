/**
 * Unit & Integration Tests for Real Photo File Import & eBay Preparation (JTH-STEP 52)
 *
 * Verifies:
 * 1. Safe parsing of valid, rights-free test JPEG & PNG binaries.
 * 2. Rejection of unsupported formats (WebP, GIF, text).
 * 3. File size limits (100B min, 10MB max).
 * 4. Header & footer marker integrity checks (corrupt files rejected).
 * 5. Bit-for-bit original binary preservation (SHA-256 match).
 * 6. Connection to Photo QA and Auto-Fix pixel pipelines.
 * 7. Explicit SKU, inventoryUnitId, and PhotoAngle binding.
 * 8. Overwrite protection & cancel preservation.
 * 9. Photo QA disclaimer presence (no false eBay guarantees).
 * 10. eBay clipboard payload formatting, 80-char title warning, USD validation, and zero state mutation.
 */

import {
  validateRealPhotoBinary,
  detectImageFormatFromMagicBytes,
  verifyImageBinaryIntegrity,
  parseImageDimensionsFromHeaders,
  processRealPhotoImport,
  computeSha256HexFromBinary,
  uint8ArrayToBase64,
  parseJpegExifOrientation,
  MAX_REAL_PHOTO_FILE_BYTES,
  MIN_REAL_PHOTO_FILE_BYTES,
  PHOTO_QA_DISCLAIMER_JA,
  ORIGINAL_BINARY_PRESERVATION_NOTE_JA
} from '../realPhotoImportService';
import {
  applyAutoFixToPhoto
} from '../photoCaptureService';
import {
  formatEbayListingClipboardPayload,
  evaluateEbayListingCopyReadiness
} from '../listingDraftReviewService';
import type {
  CapturedPhoto,
  PhotoCaptureTargetContext
} from '../../types/photoCapture';

// CRC-32 Table & Generator for valid test PNG generation
function makeCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return table;
}

const CRC_TABLE = makeCrcTable();

function calculateCrc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Generates valid, minimal, rights-free PNG binary bytes with given dimensions and uniform fill.
 */
function createValidTestPngBytes(width: number, height: number, lum: number = 120): Uint8Array {
  // PNG Signature: 8 bytes
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

  // IHDR chunk data: 13 bytes
  // Width (4), Height (4), BitDepth: 8 (1), ColorType: 2 (RGB) (1), Comp: 0 (1), Filter: 0 (1), Interlace: 0 (1)
  const ihdrData = new Uint8Array(13);
  ihdrData[0] = (width >>> 24) & 0xff;
  ihdrData[1] = (width >>> 16) & 0xff;
  ihdrData[2] = (width >>> 8) & 0xff;
  ihdrData[3] = width & 0xff;
  ihdrData[4] = (height >>> 24) & 0xff;
  ihdrData[5] = (height >>> 16) & 0xff;
  ihdrData[6] = (height >>> 8) & 0xff;
  ihdrData[7] = height & 0xff;
  ihdrData[8] = 8; // 8 bits per sample
  ihdrData[9] = 2; // Color type: Truecolor RGB
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const ihdrChunkHeader = new Uint8Array([0x49, 0x48, 0x44, 0x52]); // "IHDR"
  const ihdrPayload = new Uint8Array(4 + 13);
  ihdrPayload.set(ihdrChunkHeader, 0);
  ihdrPayload.set(ihdrData, 4);
  const ihdrCrc = calculateCrc32(ihdrPayload);

  // Uncompressed dummy IDAT chunk
  const idatChunkHeader = new Uint8Array([0x49, 0x44, 0x41, 0x54]); // "IDAT"
  // Minimal zlib block: 78 01 (header) 01 01 00 FE FF [dummy data] + adler32
  const zlibData = new Uint8Array([
    0x78, 0x01, 0x01, 0x04, 0x00, 0xfb, 0xff, 0x00, lum, lum, lum, 0x03, 0x64, 0x01, 0x69
  ]);
  const idatPayload = new Uint8Array(4 + zlibData.length);
  idatPayload.set(idatChunkHeader, 0);
  idatPayload.set(zlibData, 4);
  const idatCrc = calculateCrc32(idatPayload);

  // IEND chunk: 0 bytes data
  const iendPayload = new Uint8Array([0x49, 0x45, 0x4e, 0x44]); // "IEND"
  const iendCrc = calculateCrc32(iendPayload);

  // Total size
  const totalLength =
    8 + // Signature
    (4 + 4 + 13 + 4) + // IHDR (len, tag, data, crc)
    (4 + 4 + zlibData.length + 4) + // IDAT
    (4 + 4 + 0 + 4); // IEND

  const png = new Uint8Array(totalLength);
  let pos = 0;

  // Signature
  png.set(signature, pos);
  pos += 8;

  // IHDR
  png.set([0, 0, 0, 13], pos); pos += 4;
  png.set(ihdrChunkHeader, pos); pos += 4;
  png.set(ihdrData, pos); pos += 13;
  png.set([
    (ihdrCrc >>> 24) & 0xff, (ihdrCrc >>> 16) & 0xff, (ihdrCrc >>> 8) & 0xff, ihdrCrc & 0xff
  ], pos); pos += 4;

  // IDAT
  png.set([0, 0, 0, zlibData.length], pos); pos += 4;
  png.set(idatChunkHeader, pos); pos += 4;
  png.set(zlibData, pos); pos += zlibData.length;
  png.set([
    (idatCrc >>> 24) & 0xff, (idatCrc >>> 16) & 0xff, (idatCrc >>> 8) & 0xff, idatCrc & 0xff
  ], pos); pos += 4;

  // IEND
  png.set([0, 0, 0, 0], pos); pos += 4;
  png.set(iendPayload, pos); pos += 4;
  png.set([
    (iendCrc >>> 24) & 0xff, (iendCrc >>> 16) & 0xff, (iendCrc >>> 8) & 0xff, iendCrc & 0xff
  ], pos); pos += 4;

  return png;
}

/**
 * Generates valid minimal rights-free JPEG bytes with SOF0 dimensions and EOI marker.
 */
function createValidTestJpegBytes(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8, // SOI
    0xff, 0xe0, // APP0 (JFIF)
    0x00, 0x10, // length = 16
    0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    0xff, 0xc0, // SOF0 (Start of Frame)
    0x00, 0x11, // length = 17
    0x08,       // precision = 8 bits
    (height >>> 8) & 0xff, height & 0xff, // Height
    (width >>> 8) & 0xff, width & 0xff,   // Width
    0x03,       // 3 components (Y, Cb, Cr)
    0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    0xff, 0xda, // SOS (Start of Scan)
    0x00, 0x08, // length = 8
    0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
    // Dummy entropy data
    0x54, 0x65, 0x73, 0x74, 0x4a, 0x70, 0x65, 0x67, 0x44, 0x61, 0x74, 0x61,
    0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x61, 0x62,
    0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x6b, 0x6c, 0x6d, 0x6e,
    0xff, 0xd9  // EOI (End of Image)
  ]);
}

function createTestJpegWithExifOrientation(orientation: number): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8,                         // SOI
    0xff, 0xe1,                         // APP1 marker
    0x00, 0x22,                         // Length = 34 bytes
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
    0x49, 0x49,                         // "II" (Intel Little-Endian)
    0x2a, 0x00,                         // TIFF magic 42
    0x08, 0x00, 0x00, 0x00,             // Offset to first IFD (8 bytes from TIFF start)
    0x01, 0x00,                         // Number of IFD entries = 1
    0x12, 0x01,                         // Tag 0x0112 (Orientation)
    0x03, 0x00,                         // Type 3 (SHORT)
    0x01, 0x00, 0x00, 0x00,             // Count = 1
    orientation & 0xff, (orientation >> 8) & 0xff, 0x00, 0x00, // Value
    0x00, 0x00, 0x00, 0x00,             // Offset to next IFD = 0
    0xff, 0xd9                          // EOI
  ]);
}

export async function runRealPhotoImportTests(): Promise<{ passed: number; failed: number; log: string[] }> {
  let passed = 0;
  let failed = 0;
  const log: string[] = [];

  const assert = (condition: boolean, testName: string) => {
    if (condition) {
      passed++;
      log.push(`  ✅ PASS: ${testName}`);
    } else {
      failed++;
      log.push(`  ❌ FAIL: ${testName}`);
    }
  };

  // Test 1: Magic byte format detection (PNG & JPEG)
  const validPng = createValidTestPngBytes(400, 300);
  const validJpeg = createValidTestJpegBytes(600, 450);
  assert(detectImageFormatFromMagicBytes(validPng) === 'PNG', 'Test 1a: PNG magic bytes detected');
  assert(detectImageFormatFromMagicBytes(validJpeg) === 'JPEG', 'Test 1b: JPEG magic bytes detected');

  // Test 2: Rejection of unsupported formats (WebP, GIF, Text)
  const webpBytes = new Uint8Array(64); webpBytes.set([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50], 0);
  const gifBytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00]);
  const textBytes = new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x20, 0x77, 0x6f, 0x72, 0x6c, 0x64]);
  assert(detectImageFormatFromMagicBytes(webpBytes) === 'UNSUPPORTED', 'Test 2a: WebP rejected as UNSUPPORTED');
  assert(detectImageFormatFromMagicBytes(gifBytes) === 'UNSUPPORTED', 'Test 2b: GIF rejected as UNSUPPORTED');
  assert(detectImageFormatFromMagicBytes(textBytes) === 'UNSUPPORTED', 'Test 2c: Plain text rejected as UNSUPPORTED');

  const webpValidation = validateRealPhotoBinary(webpBytes, 'photo.webp');
  assert(!webpValidation.isValid && webpValidation.errorCode === 'UNSUPPORTED_FORMAT', 'Test 2d: validateRealPhotoBinary returns UNSUPPORTED_FORMAT');

  // Test 3: File size boundary - Reject files > 10MB
  const oversizedDummy = new Uint8Array(MAX_REAL_PHOTO_FILE_BYTES + 1);
  oversizedDummy.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const oversizeValidation = validateRealPhotoBinary(oversizedDummy, 'large_camera.png');
  assert(!oversizeValidation.isValid && oversizeValidation.errorCode === 'FILE_TOO_LARGE', 'Test 3: File > 10MB rejected with FILE_TOO_LARGE');

  // Test 4: File size boundary - Reject files < 100 bytes
  const tinyBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const tinyValidation = validateRealPhotoBinary(tinyBytes, 'tiny.jpg');
  assert(!tinyValidation.isValid && tinyValidation.errorCode === 'FILE_TOO_SMALL', 'Test 4: File < 100B rejected with FILE_TOO_SMALL');

  // Test 5: Header/footer integrity - Reject truncated JPEG missing EOI
  const corruptJpeg = validJpeg.slice(0, validJpeg.length - 2); // Strip FF D9
  const corruptJpegInteg = verifyImageBinaryIntegrity(corruptJpeg, 'JPEG');
  assert(!corruptJpegInteg.isValid, 'Test 5: Truncated JPEG without EOI marker fails integrity check');

  // Test 6: Header/footer integrity - Reject truncated PNG missing IEND
  const corruptPng = validPng.slice(0, validPng.length - 12); // Strip IEND
  const corruptPngInteg = verifyImageBinaryIntegrity(corruptPng, 'PNG');
  assert(!corruptPngInteg.isValid, 'Test 6: Truncated PNG without IEND chunk fails integrity check');

  // Test 7: Dimension parsing from headers
  const pngDims = parseImageDimensionsFromHeaders(validPng, 'PNG');
  assert(pngDims !== null && pngDims.width === 400 && pngDims.height === 300, 'Test 7a: PNG IHDR dimensions parsed accurately');
  const jpegDims = parseImageDimensionsFromHeaders(validJpeg, 'JPEG');
  assert(jpegDims !== null && jpegDims.width === 600 && jpegDims.height === 450, 'Test 7b: JPEG SOF0 dimensions parsed accurately');

  // Test 8: SHA-256 calculation directly from binary
  const sha256Png = computeSha256HexFromBinary(validPng);
  assert(typeof sha256Png === 'string' && sha256Png.length === 64, 'Test 8: computeSha256HexFromBinary produces 64-char hex checksum');

  // Test 9: Real Photo Import processing (Valid PNG)
  const targetContext: PhotoCaptureTargetContext = {
    sku: 'SKU-CAMERA-LENS-01',
    inventoryUnitId: 'UNIT-2026-0105',
    isConfirmed: true
  };

  const dummyFileInput = {
    name: 'lens_front.png',
    size: validPng.length,
    type: 'image/png',
    arrayBuffer: async () => (validPng.buffer.slice(validPng.byteOffset, validPng.byteOffset + validPng.byteLength) as ArrayBuffer)
  };

  const importResult = await processRealPhotoImport({
    file: dummyFileInput,
    targetAngle: 'FRONT',
    targetContext
  });

  assert(importResult !== null && importResult.success === true, 'Test 9a: processRealPhotoImport succeeds for valid PNG');
  assert(importResult?.photo?.angle === 'FRONT', 'Test 9b: Correct PhotoAngle bound to imported photo');
  assert(importResult?.photo?.sku === 'SKU-CAMERA-LENS-01', 'Test 9c: Correct SKU bound to imported photo');
  assert(importResult?.photo?.inventoryUnitId === 'UNIT-2026-0105', 'Test 9d: Correct Unit ID bound to imported photo');
  assert(Boolean(importResult?.photo?.fileMetadata?.isRealFile), 'Test 9e: fileMetadata marked as isRealFile');
  assert(importResult?.photo?.fileMetadata?.sha256Hex === sha256Png, 'Test 9f: Bit-for-bit SHA-256 matches input binary');

  // Test 10: Bit-for-bit Raw Binary Preservation
  const importedPhoto: CapturedPhoto = importResult.photo!;
  assert(importedPhoto.originalDataUrl === importedPhoto.dataUrl, 'Test 10a: originalDataUrl matches initial dataUrl bit-for-bit');
  assert(Boolean(importedPhoto.originalDataUrl?.startsWith('data:image/png;base64,')), 'Test 10b: originalDataUrl formatted as Data URL');

  // Test 11: Auto-Fix connectivity on Real Imported Photo
  const autoFixPendingPhoto: CapturedPhoto = {
    ...importedPhoto,
    qaResult: {
      status: 'AUTO_FIX',
      issues: [{ code: 'EXPOSURE_UNDER', severity: 'WARNING', message: '露出不足です' }],
      metrics: { blurScore: 10, brightness: 45, framingCoverage: 80, glareScore: 5 },
      suggestedAction: 'AUTO_FIX推奨'
    }
  };
  const fixedPhoto = applyAutoFixToPhoto(autoFixPendingPhoto);
  assert(fixedPhoto.originalDataUrl === importedPhoto.originalDataUrl, 'Test 11a: applyAutoFix preserves untouched originalDataUrl');
  assert(fixedPhoto.autoFixCount === 1, 'Test 11b: autoFixCount incremented to 1');

  // Test 12: Overwrite Protection Gate
  const overwriteAttemptResult = await processRealPhotoImport({
    file: dummyFileInput,
    targetAngle: 'FRONT',
    targetContext,
    existingPhoto: importedPhoto,
    allowOverwrite: false
  });

  assert(overwriteAttemptResult !== null && overwriteAttemptResult.success === false, 'Test 12a: Overwrite rejected when allowOverwrite is false');
  assert(overwriteAttemptResult?.validation?.errorCode === 'OVERWRITE_CONFIRMATION_REQUIRED', 'Test 12b: Error code is OVERWRITE_CONFIRMATION_REQUIRED');

  // Test 13: Overwrite Confirmed Gate
  const overwriteApprovedResult = await processRealPhotoImport({
    file: dummyFileInput,
    targetAngle: 'FRONT',
    targetContext,
    existingPhoto: importedPhoto,
    allowOverwrite: true
  });

  assert(overwriteApprovedResult !== null && overwriteApprovedResult.success === true, 'Test 13: Overwrite succeeds when allowOverwrite is true');

  // Test 14: Quality Disclaimer Presence
  assert(PHOTO_QA_DISCLAIMER_JA.includes('補助判定'), 'Test 14a: QA disclaimer explicitly states auxiliary judgment');
  assert(ORIGINAL_BINARY_PRESERVATION_NOTE_JA.includes('原本バイナリは未加工'), 'Test 14b: Preservation note explicitly mentions raw binary immutability');

  // Test 15: eBay Listing Clipboard Payload Formatting
  const clipboardPayload = formatEbayListingClipboardPayload({
    sku: 'SKU-RETRO-GAME-01',
    inventoryUnitId: 'UNIT-2026-0042',
    sellerAccountId: 'JP_STORE_OFFICIAL',
    listingTitle: 'Sony PlayStation 1 Console Scph-1000 Japan Complete in Box',
    listingDescription: 'Tested and working Japanese PS1 console with original box and AV cables.',
    priceAmount: 89.99,
    priceCurrency: 'USD',
    shippingTerms: 'Standard International Shipping from Japan with Tracking (FedEx / Japan Post)'
  });

  assert(clipboardPayload.includes('=== eBay LISTING DRAFT [SKU: SKU-RETRO-GAME-01] ==='), 'Test 15a: eBay clipboard payload includes SKU header');
  assert(clipboardPayload.includes('Sony PlayStation 1 Console'), 'Test 15b: Title included');
  assert(clipboardPayload.includes('USD 89.99'), 'Test 15c: USD price formatted with 2 decimal places');
  assert(clipboardPayload.includes('=== END OF DRAFT ==='), 'Test 15d: Clear end of draft demarcation');

  // Test 16: eBay Copy Readiness - Missing Fields
  const incompleteDraft = {
    sku: 'SKU-TEST-01',
    listingTitle: '',
    listingDescription: '',
    priceAmount: 0,
    priceCurrency: 'USD',
    shippingTerms: ''
  };
  const readinessIncomplete = evaluateEbayListingCopyReadiness(incompleteDraft);
  assert(!readinessIncomplete.canCopy, 'Test 16a: canCopy is false when required fields are empty');
  assert(readinessIncomplete.blockingIssuesJa.length >= 4, 'Test 16b: Flags missing title, description, price, and terms');

  // Test 17: eBay Copy Readiness - 80 Char Title Warning & Currency Warning
  const longTitleDraft = {
    sku: 'SKU-TEST-02',
    listingTitle: 'This is an extremely long title that exceeds the strict eighty character limit enforced by eBay international marketplace catalog rules',
    listingDescription: 'Good condition vintage camera lens.',
    priceAmount: 150.00,
    priceCurrency: 'JPY',
    shippingTerms: 'Expedited shipping'
  };
  const readinessWarnings = evaluateEbayListingCopyReadiness(longTitleDraft);
  assert(readinessWarnings.canCopy === true, 'Test 17a: canCopy is true because issues are warnings, not hard blocks');
  assert(readinessWarnings.warningsJa.some((w) => w.includes('80文字を超過')), 'Test 17b: Warns about 80-character title limit');
  assert(readinessWarnings.warningsJa.some((w) => w.includes('JPY')), 'Test 17c: Warns about non-USD currency code');

  // Test 18: Zero State Mutation on Copy
  // Calling formatEbayListingClipboardPayload and evaluateEbayListingCopyReadiness are pure functions
  const pureCheckBefore = JSON.stringify(longTitleDraft);
  evaluateEbayListingCopyReadiness(longTitleDraft);
  const pureCheckAfter = JSON.stringify(longTitleDraft);
  assert(pureCheckBefore === pureCheckAfter, 'Test 18: Zero mutation on input data during copy readiness evaluation');

  // Test 19: JPEG EXIF Orientation Tag Parsing
  const exifJpeg6 = createTestJpegWithExifOrientation(6);
  const parsedOrientation6 = parseJpegExifOrientation(exifJpeg6);
  assert(parsedOrientation6 === 6, 'Test 19a: parseJpegExifOrientation correctly extracts Orientation = 6 from APP1');

  const exifJpeg1 = createTestJpegWithExifOrientation(1);
  const parsedOrientation1 = parseJpegExifOrientation(exifJpeg1);
  assert(parsedOrientation1 === 1, 'Test 19b: parseJpegExifOrientation correctly extracts Orientation = 1');

  const noExifJpeg = validJpeg; // Has JFIF APP0, no APP1 Exif
  assert(parseJpegExifOrientation(noExifJpeg) === null, 'Test 19c: parseJpegExifOrientation returns null when no Exif marker present');
  assert(parseJpegExifOrientation(validPng) === null, 'Test 19d: parseJpegExifOrientation returns null for PNG binary');

  // Test 20: Strict Unit ID vs SKU Isolation
  // Unconfirmed / missing Unit ID must NOT be replaced with SKU
  const draftWithoutUnitId = {
    sku: 'SKU-CAMERA-100',
    inventoryUnitId: undefined,
    sellerAccountId: 'JP_STORE_OFFICIAL',
    listingTitle: 'Olympus OM-1 35mm SLR Film Camera Body Japan',
    listingDescription: 'Shutter fires, cosmetic wear consistent with age.',
    priceAmount: 120.00,
    priceCurrency: 'USD',
    shippingTerms: 'FedEx International'
  };
  const payloadWithoutUnitId = formatEbayListingClipboardPayload(draftWithoutUnitId);
  assert(payloadWithoutUnitId.includes('Unit ID: 未指定 (現物個体未確定)'), 'Test 20a: Missing Unit ID outputs explicit unconfirmed marker');
  assert(!payloadWithoutUnitId.includes('Unit ID (個体管理番号): SKU-CAMERA-100'), 'Test 20b: SKU is never used to substitute missing Unit ID');

  const readinessWithoutUnitId = evaluateEbayListingCopyReadiness(draftWithoutUnitId);
  assert(readinessWithoutUnitId.warningsJa.some((w) => w.includes('Unit ID')), 'Test 20c: Readiness warns about unconfirmed Unit ID');

  const draftWithRealUnitId = {
    ...draftWithoutUnitId,
    inventoryUnitId: 'UNIT-REAL-9999'
  };
  const payloadWithRealUnitId = formatEbayListingClipboardPayload(draftWithRealUnitId);
  assert(payloadWithRealUnitId.includes('Unit ID (個体管理番号): UNIT-REAL-9999'), 'Test 20d: Confirmed Unit ID is clearly distinct from SKU');
  assert(payloadWithRealUnitId.includes('SKU: SKU-CAMERA-100'), 'Test 20e: SKU and Unit ID are preserved side-by-side without confusion');

  return { passed, failed, log };
}
