/**
 * Authoritative ISO 3166-1 Country & Territory Data
 * Includes complete ISO 3166-1 Alpha-2 and Alpha-3 codes, numeric codes,
 * and canonical international country names for worldwide shipping validation.
 */

/** Complete ISO 3166-1 Alpha-2 Country Codes */
export const ISO_3166_1_ALPHA_2 = new Set([
  'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ',
  'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS',
  'BT', 'BV', 'BW', 'BY', 'BZ', 'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN',
  'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE',
  'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE', 'GF',
  'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HM',
  'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM',
  'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC',
  'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK',
  'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA',
  'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG',
  'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW',
  'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS',
  'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO',
  'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI',
  'VN', 'VU', 'WF', 'WS', 'YE', 'YT', 'ZA', 'ZM', 'ZW'
]);

/** Complete ISO 3166-1 Alpha-3 Country Codes */
export const ISO_3166_1_ALPHA_3 = new Set([
  'ABW', 'AFG', 'AGO', 'AIA', 'ALA', 'ALB', 'AND', 'ARE', 'ARG', 'ARM', 'ASM', 'ATA', 'ATF', 'ATG',
  'AUS', 'AUT', 'AZE', 'BDI', 'BEL', 'BEN', 'BES', 'BFA', 'BGD', 'BGR', 'BHR', 'BHS', 'BIH', 'BLM',
  'BLR', 'BLZ', 'BMU', 'BOL', 'BRA', 'BRB', 'BRN', 'BTN', 'BVT', 'BWA', 'CAF', 'CAN', 'CCK', 'CHE',
  'CHL', 'CHN', 'CIV', 'CMR', 'COD', 'COG', 'COK', 'COL', 'COM', 'CPV', 'CRI', 'CUB', 'CUW', 'CXR',
  'CYM', 'CYP', 'CZE', 'DEU', 'DJI', 'DMA', 'DNK', 'DOM', 'DZA', 'ECU', 'EGY', 'ERI', 'ESH', 'ESP',
  'EST', 'ETH', 'FIN', 'FJI', 'FLK', 'FRA', 'FRO', 'FSM', 'GAB', 'GBR', 'GEO', 'GGY', 'GHA', 'GIB',
  'GIN', 'GLP', 'GMB', 'GNB', 'GNQ', 'GRC', 'GRD', 'GRL', 'GTM', 'GUF', 'GUM', 'GUY', 'HKG', 'HMD',
  'HND', 'HRV', 'HTI', 'HUN', 'IDN', 'IMN', 'IND', 'IOT', 'IRL', 'IRN', 'IRQ', 'ISL', 'ISR', 'ITA',
  'JAM', 'JEY', 'JOR', 'JPN', 'KAZ', 'KEN', 'KGZ', 'KHM', 'KIR', 'KNA', 'KOR', 'KWT', 'LAO', 'LBN',
  'LBR', 'LBY', 'LCA', 'LIE', 'LKA', 'LSO', 'LTU', 'LUX', 'LVA', 'MAC', 'MAF', 'MAR', 'MCO', 'MDA',
  'MDG', 'MDV', 'MEX', 'MHL', 'MKD', 'MLI', 'MLT', 'MMR', 'MNE', 'MNG', 'MNP', 'MOZ', 'MRT', 'MSR',
  'MTQ', 'MUS', 'MWI', 'MYS', 'MYT', 'NAM', 'NCL', 'NER', 'NFK', 'NGA', 'NIC', 'NIU', 'NLD', 'NOR',
  'NPL', 'NRU', 'NZL', 'OMN', 'PAK', 'PAN', 'PCN', 'PER', 'PHL', 'PLW', 'PNG', 'POL', 'PRI', 'PRK',
  'PRT', 'PRY', 'PSE', 'PYF', 'QAT', 'REU', 'ROU', 'RUS', 'RWA', 'SAU', 'SDN', 'SEN', 'SGP', 'SGS',
  'SHN', 'SJM', 'SLB', 'SLE', 'SLV', 'SMR', 'SOM', 'SPM', 'SRB', 'SSD', 'STP', 'SUR', 'SVK', 'SVN',
  'SWE', 'SWZ', 'SXM', 'SYC', 'SYR', 'TCA', 'TCD', 'TGO', 'THA', 'TJK', 'TKL', 'TKM', 'TLS', 'TON',
  'TTO', 'TUN', 'TUR', 'TUV', 'TWN', 'TZA', 'UGA', 'UKR', 'UMI', 'URY', 'USA', 'UZB', 'VAT', 'VCT',
  'VEN', 'VGB', 'VIR', 'VNM', 'VUT', 'WLF', 'WSM', 'YEM', 'ZAF', 'ZMB', 'ZWE'
]);

/** Recognized Official English & Local Country Names */
export const RECOGNIZED_COUNTRY_NAMES = new Set([
  'AFGHANISTAN', 'ALAND ISLANDS', 'ALBANIA', 'ALGERIA', 'AMERICAN SAMOA', 'ANDORRA', 'ANGOLA', 'ANGUILLA',
  'ANTARCTICA', 'ANTIGUA AND BARBUDA', 'ARGENTINA', 'ARMENIA', 'ARUBA', 'AUSTRALIA', 'AUSTRIA', 'AZERBAIJAN',
  'BAHAMAS', 'BAHRAIN', 'BANGLADESH', 'BARBADOS', 'BELARUS', 'BELGIUM', 'BELIZE', 'BENIN', 'BERMUDA',
  'BHUTAN', 'BOLIVIA', 'BONAIRE', 'BOSNIA AND HERZEGOVINA', 'BOTSWANA', 'BRAZIL', 'BRUNEI', 'BULGARIA',
  'BURKINA FASO', 'BURUNDI', 'CABO VERDE', 'CAPE VERDE', 'CAMBODIA', 'CAMEROON', 'CANADA', 'CAYMAN ISLANDS',
  'CENTRAL AFRICAN REPUBLIC', 'CHAD', 'CHILE', 'CHINA', 'COLOMBIA', 'COMOROS', 'CONGO', 'COOK ISLANDS',
  'COSTA RICA', 'COTE D\'IVOIRE', 'IVORY COAST', 'CROATIA', 'CUBA', 'CURACAO', 'CYPRUS', 'CZECHIA',
  'CZECH REPUBLIC', 'DENMARK', 'DJIBOUTI', 'DOMINICA', 'DOMINICAN REPUBLIC', 'ECUADOR', 'EGYPT',
  'EL SALVADOR', 'EQUATORIAL GUINEA', 'ERITREA', 'ESTONIA', 'ESWATINI', 'SWAZILAND', 'ETHIOPIA',
  'FALKLAND ISLANDS', 'FAROE ISLANDS', 'FIJI', 'FINLAND', 'FRANCE', 'FRENCH GUIANA', 'FRENCH POLYNESIA',
  'GABON', 'GAMBIA', 'GEORGIA', 'GERMANY', 'DEUTSCHLAND', 'GHANA', 'GIBRALTAR', 'GREECE', 'GREENLAND',
  'GRENADA', 'GUADELOUPE', 'GUAM', 'GUATEMALA', 'GUERNSEY', 'GUINEA', 'GUINEA-BISSAU', 'GUYANA', 'HAITI',
  'HOLY SEE', 'VATICAN CITY', 'HONDURAS', 'HONG KONG', 'HUNGARY', 'ICELAND', 'INDIA', 'INDONESIA',
  'IRAN', 'IRAQ', 'IRELAND', 'ISLE OF MAN', 'ISRAEL', 'ITALY', 'ITALIA', 'JAMAICA', 'JAPAN', '日本',
  'JERSEY', 'JORDAN', 'KAZAKHSTAN', 'KENYA', 'KIRIBATI', 'KOREA', 'SOUTH KOREA', 'NORTH KOREA', 'KUWAIT',
  'KYRGYZSTAN', 'LAOS', 'LATVIA', 'LEBANON', 'LESOTHO', 'LIBERIA', 'LIBYA', 'LIECHTENSTEIN', 'LITHUANIA',
  'LUXEMBOURG', 'MACAO', 'MACAU', 'MADAGASCAR', 'MALAWI', 'MALAYSIA', 'MALDIVES', 'MALI', 'MALTA',
  'MARSHALL ISLANDS', 'MARTINIQUE', 'MAURITANIA', 'MAURITIUS', 'MAYOTTE', 'MEXICO', 'MICRONESIA', 'MOLDOVA',
  'MONACO', 'MONGOLIA', 'MONTENEGRO', 'MONTSERRAT', 'MOROCCO', 'MOZAMBIQUE', 'MYANMAR', 'BURMA', 'NAMIBIA',
  'NAURU', 'NEPAL', 'NETHERLANDS', 'HOLLAND', 'NEW CALEDONIA', 'NEW ZEALAND', 'NICARAGUA', 'NIGER', 'NIGERIA',
  'NIUE', 'NORFOLK ISLAND', 'NORTH MACEDONIA', 'NORTHERN MARIANA ISLANDS', 'NORWAY', 'OMAN', 'PAKISTAN',
  'PALAU', 'PALESTINE', 'PANAMA', 'PAPUA NEW GUINEA', 'PARAGUAY', 'PERU', 'PHILIPPINES', 'PITCAIRN', 'POLAND',
  'PORTUGAL', 'PUERTO RICO', 'QATAR', 'REUNION', 'ROMANIA', 'RUSSIA', 'RUSSIAN FEDERATION', 'RWANDA',
  'SAINT BARTHÉLEMY', 'SAINT HELENA', 'SAINT KITTS AND NEVIS', 'SAINT LUCIA', 'SAINT MARTIN',
  'SAINT PIERRE AND MIQUELON', 'SAINT VINCENT AND THE GRENADINES', 'SAMOA', 'SAN MARINO',
  'SAO TOME AND PRINCIPE', 'SAUDI ARABIA', 'SENEGAL', 'SERBIA', 'SEYCHELLES', 'SIERRA LEONE', 'SINGAPORE',
  'SINT MAARTEN', 'SLOVAKIA', 'SLOVENIA', 'SOLOMON ISLANDS', 'SOMALIA', 'SOUTH AFRICA', 'SOUTH GEORGIA',
  'SOUTH SUDAN', 'SPAIN', 'ESPAÑA', 'SRI LANKA', 'SUDAN', 'SURINAME', 'SWEDEN', 'SWITZERLAND', 'SYRIA',
  'TAIWAN', 'TAJIKISTAN', 'TANZANIA', 'THAILAND', 'TIMOR-LESTE', 'TOGO', 'TOKELAU', 'TONGA',
  'TRINIDAD AND TOBAGO', 'TUNISIA', 'TURKEY', 'TÜRKIYE', 'TURKMNEISTAN', 'TURKS AND CAICOS ISLANDS',
  'TUVALU', 'UGANDA', 'UKRAINE', 'UNITED ARAB EMIRATES', 'UAE', 'UNITED KINGDOM', 'UK', 'GREAT BRITAIN',
  'UNITED STATES', 'USA', 'U.S.A.', 'UNITED STATES OF AMERICA', 'AMERICA', 'URUGUAY', 'UZBEKISTAN',
  'VANUATU', 'VENEZUELA', 'VIETNAM', 'VIET NAM', 'VIRGIN ISLANDS', 'WALLIS AND FUTUNA', 'WESTERN SAHARA',
  'YEMEN', 'ZAMBIA', 'ZIMBABWE'
]);

/**
 * Validates whether a given country code is a recognized, official ISO 3166-1 alpha-2 or alpha-3 code (excluding Japan).
 */
export function isRecognizedIsoCountryCode(code: string): boolean {
  if (!code) return false;
  const upper = code.trim().toUpperCase();
  if (upper === 'JP' || upper === 'JPN') return false;
  return ISO_3166_1_ALPHA_2.has(upper) || ISO_3166_1_ALPHA_3.has(upper);
}

/**
 * Validates whether a given country name is a recognized real country name (excluding Japan).
 */
export function isRecognizedCountryName(name: string): boolean {
  if (!name) return false;
  const upper = name.trim().toUpperCase();
  if (upper === 'JAPAN' || upper === '日本' || upper === 'JAPON' || upper === 'JAPANESE') return false;
  return RECOGNIZED_COUNTRY_NAMES.has(upper);
}
