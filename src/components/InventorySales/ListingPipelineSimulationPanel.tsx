import React, { useState } from 'react';
import {
  PipelineScenarioType,
  ListingPipelineSimulationResult,
  createMockPipelineScenario,
  executeListingPipelineSimulation
} from '../../services/listingPipelineSimulationService';

const panelStyle: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.94)',
  border: '1px solid rgba(148, 163, 184, 0.22)',
  borderRadius: 14,
  padding: 18,
  marginBottom: 16,
  color: '#f8fafc'
};

const cardStyle: React.CSSProperties = {
  background: 'rgba(30, 41, 59, 0.65)',
  border: '1px solid rgba(148, 163, 184, 0.18)',
  borderRadius: 10,
  padding: 14,
  marginBottom: 12
};

const badgeStyle = (status: 'PASSED' | 'HOLD' | 'BLOCKED' | 'NOT_REACHED'): React.CSSProperties => {
  switch (status) {
    case 'PASSED':
      return {
        background: 'rgba(16, 185, 129, 0.2)',
        color: '#34d399',
        border: '1px solid #10b981',
        padding: '3px 8px',
        borderRadius: 6,
        fontSize: '0.75rem',
        fontWeight: 700
      };
    case 'HOLD':
      return {
        background: 'rgba(245, 158, 11, 0.2)',
        color: '#fbbf24',
        border: '1px solid #f59e0b',
        padding: '3px 8px',
        borderRadius: 6,
        fontSize: '0.75rem',
        fontWeight: 700
      };
    case 'BLOCKED':
      return {
        background: 'rgba(239, 68, 68, 0.2)',
        color: '#f87171',
        border: '1px solid #ef4444',
        padding: '3px 8px',
        borderRadius: 6,
        fontSize: '0.75rem',
        fontWeight: 700
      };
    case 'NOT_REACHED':
    default:
      return {
        background: 'rgba(100, 116, 139, 0.2)',
        color: '#94a3b8',
        border: '1px solid #475569',
        padding: '3px 8px',
        borderRadius: 6,
        fontSize: '0.75rem',
        fontWeight: 700
      };
  }
};

const SCENARIO_LABELS: Record<PipelineScenarioType, string> = {
  SUCCESS_FULL_PASS: '🟢 正常系: 必須4アングル合格・全6工程完全通過',
  RETRY_SUCCESS: '🔄 正常系: 再撮影・再試行後の完全合格',
  UNTAKEN_PHOTOS: '⚠️ 異常系: 未撮影アングルあり (3面欠損)',
  QA_RETAKE: '⚠️ 異常系: QA再撮影 (被写体ぶれ)',
  AUTO_FIX_PENDING: '⚠️ 異常系: 自動補正未適用 (露出不足)',
  CROSS_PRODUCT_POLLUTION: '🚫 異常系: 別商品写真混入 (別SKU記録)',
  STALE_SESSION: '⚠️ 異常系: 古い撮影結果 (タイムスタンプ不整合)',
  UNIT_ID_MISMATCH: '❌ 異常系: 個体ID不一致 (Context vs Snapshot)',
  DUPLICATE_REGISTRATION: '🚫 異常系: 二重登録・上書き衝突防止',
  MIDWAY_ABORTED: '⚠️ 異常系: 撮影セッション中断',
  NON_PHOTO_GATE_INCOMPLETE: '⚠️ 異常系: 非写真ゲート未達 (検品・保管場所未済)',
  DRAFT_REVIEW_MISSING_PRICE: '⚠️ 異常系: ドラフト価格未設定 (販売価格0)',
  PUBLISH_GATE_MISSING_APPROVAL: '⚠️ 異常系: 出品審査未承認 (アカウント未確認)'
};

export const ListingPipelineSimulationPanel: React.FC = () => {
  const [selectedScenario, setSelectedScenario] = useState<PipelineScenarioType>('SUCCESS_FULL_PASS');
  const [result, setResult] = useState<ListingPipelineSimulationResult | null>(() => {
    const opts = createMockPipelineScenario('SUCCESS_FULL_PASS');
    return executeListingPipelineSimulation(opts);
  });
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  const handleRunSimulation = (scenario: PipelineScenarioType) => {
    const opts = createMockPipelineScenario(scenario);
    const simResult = executeListingPipelineSimulation(opts);
    setResult(simResult);
  };

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🚀</span> 出品準備フロー一括検証 End-to-End シミュレーション
          </h2>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 4 }}>
            写真撮影 → 在庫ゲート → ドラフト連携 → 下書き作成 → ドラフト審査 → 出品前審査を完全隔離・メモリ上で一括検証します。
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: 6, background: '#1e293b', color: '#38bdf8', border: '1px solid #0284c7' }}>
            ハードウェア状態: {result?.hardwareStatus || 'HARDWARE_PENDING'}
          </span>
        </div>
      </div>

      {/* Safety Notice Banner */}
      <div
        style={{
          background: 'rgba(56, 189, 248, 0.08)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: '0.78rem',
          color: '#bae6fd',
          marginBottom: 16
        }}
      >
        🔒 <strong>安全保護の保証:</strong> 本機能は純粋なローカル Dry Run エミュレーションです。本番在庫DB、localStorage、eBay/Shopee 本番APIへの書き込みは一切行いません。
      </div>

      {/* Scenario Selector & Action Bar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0' }}>検証シナリオ:</label>
        <select
          value={selectedScenario}
          onChange={(e) => {
            const sc = e.target.value as PipelineScenarioType;
            setSelectedScenario(sc);
            handleRunSimulation(sc);
          }}
          style={{
            background: '#1e293b',
            color: '#f8fafc',
            border: '1px solid #475569',
            borderRadius: 8,
            padding: '7px 12px',
            fontSize: '0.82rem',
            cursor: 'pointer',
            flex: 1,
            minWidth: 320
          }}
        >
          {(Object.keys(SCENARIO_LABELS) as PipelineScenarioType[]).map((key) => (
            <option key={key} value={key}>
              {SCENARIO_LABELS[key]}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => handleRunSimulation(selectedScenario)}
          style={{
            background: 'linear-gradient(135deg, #0284c7, #2563eb)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          🔄 シミュレーション再実行
        </button>
      </div>

      {/* Result Summary Card */}
      {result && (
        <div
          style={{
            background: result.overallSuccess
              ? 'rgba(16, 185, 129, 0.12)'
              : 'rgba(245, 158, 11, 0.12)',
            border: result.overallSuccess
              ? '1px solid #10b981'
              : '1px solid #f59e0b',
            borderRadius: 10,
            padding: 12,
            marginBottom: 16
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: result.overallSuccess ? '#34d399' : '#fbbf24' }}>
              {result.overallSuccess ? '✅ 全工程合格 (Overall E2E Passed)' : '⚠️ 保留または停止 (Pipeline Hold / Blocked)'}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              SKU: {result.sku} | Unit: {result.inventoryUnitId}
            </span>
          </div>
          <div style={{ fontSize: '0.82rem', color: '#e2e8f0' }}>{result.summaryJa}</div>
        </div>
      )}

      {/* 6 Pipeline Stages Visualizer */}
      {result && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
          {/* Stage 1 */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#38bdf8' }}>1. {result.stages.photoCapture.displayNameJa}</span>
              <span style={badgeStyle(result.stages.photoCapture.status)}>{result.stages.photoCapture.status}</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 4 }}>
              判定コード: <code>{result.stages.photoCapture.reasonCode}</code>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginBottom: 6 }}>{result.stages.photoCapture.reasonMessageJa}</div>
            <div style={{ fontSize: '0.75rem', color: '#38bdf8' }}>👉 次のアクション: {result.stages.photoCapture.nextActionJa}</div>
          </div>

          {/* Stage 2 */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#38bdf8' }}>2. {result.stages.inventoryGate.displayNameJa}</span>
              <span style={badgeStyle(result.stages.inventoryGate.status)}>{result.stages.inventoryGate.status}</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 4 }}>
              判定コード: <code>{result.stages.inventoryGate.reasonCode}</code>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginBottom: 6 }}>{result.stages.inventoryGate.reasonMessageJa}</div>
            <div style={{ fontSize: '0.75rem', color: '#38bdf8' }}>👉 次のアクション: {result.stages.inventoryGate.nextActionJa}</div>
          </div>

          {/* Stage 3 */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#c084fc' }}>3. {result.stages.photoHandoff.displayNameJa}</span>
              <span style={badgeStyle(result.stages.photoHandoff.status)}>{result.stages.photoHandoff.status}</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 4 }}>
              判定コード: <code>{result.stages.photoHandoff.reasonCode}</code>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginBottom: 6 }}>{result.stages.photoHandoff.reasonMessageJa}</div>
            <div style={{ fontSize: '0.75rem', color: '#c084fc' }}>👉 次のアクション: {result.stages.photoHandoff.nextActionJa}</div>
          </div>

          {/* Stage 4 */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#fb923c' }}>4. {result.stages.listingPreparation.displayNameJa}</span>
              <span style={badgeStyle(result.stages.listingPreparation.status)}>{result.stages.listingPreparation.status}</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 4 }}>
              判定コード: <code>{result.stages.listingPreparation.reasonCode}</code>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginBottom: 6 }}>{result.stages.listingPreparation.reasonMessageJa}</div>
            <div style={{ fontSize: '0.75rem', color: '#fb923c' }}>👉 次のアクション: {result.stages.listingPreparation.nextActionJa}</div>
          </div>

          {/* Stage 5 */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#34d399' }}>5. {result.stages.draftReview.displayNameJa}</span>
              <span style={badgeStyle(result.stages.draftReview.status)}>{result.stages.draftReview.status}</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 4 }}>
              判定コード: <code>{result.stages.draftReview.reasonCode}</code>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginBottom: 6 }}>{result.stages.draftReview.reasonMessageJa}</div>
            <div style={{ fontSize: '0.75rem', color: '#34d399' }}>👉 次のアクション: {result.stages.draftReview.nextActionJa}</div>
          </div>

          {/* Stage 6 */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#a78bfa' }}>6. {result.stages.publishGate.displayNameJa}</span>
              <span style={badgeStyle(result.stages.publishGate.status)}>{result.stages.publishGate.status}</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 4 }}>
              判定コード: <code>{result.stages.publishGate.reasonCode}</code>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginBottom: 6 }}>{result.stages.publishGate.reasonMessageJa}</div>
            <div style={{ fontSize: '0.75rem', color: '#a78bfa' }}>👉 次のアクション: {result.stages.publishGate.nextActionJa}</div>
          </div>
        </div>
      )}

      {/* Detailed Diff & Evidence Modal / Viewer Toggle */}
      {result && result.stages.photoHandoff.stageData && (
        <div style={{ marginTop: 12, textAlign: 'right' }}>
          <button
            type="button"
            onClick={() => setExpandedStage(expandedStage ? null : 'DETAILS')}
            style={{
              background: 'none',
              border: '1px solid #475569',
              borderRadius: 6,
              color: '#94a3b8',
              padding: '5px 12px',
              fontSize: '0.78rem',
              cursor: 'pointer'
            }}
          >
            {expandedStage ? '▲ 詳細情報を閉じる' : '▼ 写真候補・ゲート差分の詳細を表示'}
          </button>
        </div>
      )}

      {expandedStage && result && (
        <div
          style={{
            marginTop: 12,
            background: '#090d16',
            border: '1px solid #334155',
            borderRadius: 8,
            padding: 14,
            fontSize: '0.8rem'
          }}
        >
          <h4 style={{ margin: '0 0 10px', color: '#e2e8f0' }}>📸 出品用写真候補プレビュー (Stage 3 & 5 詳細)</h4>
          {result.stages.photoHandoff.stageData?.heroPhoto ? (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#38bdf8', marginBottom: 4 }}>⭐ Hero画像 (正面)</div>
                <img
                  src={result.stages.photoHandoff.stageData.heroPhoto.selectedListingUrl}
                  alt="Hero Preview"
                  style={{ width: 100, height: 100, borderRadius: 6, border: '1px solid #38bdf8', objectFit: 'cover' }}
                />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 4 }}>
                  追加ギャラリー写真 ({result.stages.photoHandoff.stageData.galleryPhotos.length - 1}枚)
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {result.stages.photoHandoff.stageData.galleryPhotos
                    .filter((p) => p.angle !== 'FRONT')
                    .map((p) => (
                      <div key={p.photoId}>
                        <img
                          src={p.selectedListingUrl}
                          alt={p.angle}
                          style={{ width: 64, height: 64, borderRadius: 4, border: '1px solid #475569', objectFit: 'cover' }}
                        />
                        <div style={{ fontSize: '0.65rem', color: '#64748b', textAlign: 'center' }}>{p.angle}</div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: '#94a3b8' }}>写真候補は未生成です。</div>
          )}
        </div>
      )}
    </div>
  );
};
