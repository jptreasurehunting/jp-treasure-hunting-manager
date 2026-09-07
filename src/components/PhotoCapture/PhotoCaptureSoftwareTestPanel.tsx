import React, { useState } from 'react';
import {
  PhotoCaptureSoftwareSelfTestSummary,
  runPhotoCaptureSoftwareSelfTest
} from '../../services/photoCaptureSelfTestService';

const panelStyle: React.CSSProperties = {
  maxWidth: 1240,
  margin: '18px auto 0',
  padding: 18,
  color: '#e2e8f0',
  background: 'rgba(15, 23, 42, 0.92)',
  border: '1px solid rgba(52, 211, 153, 0.3)',
  borderRadius: 14
};

const buttonStyle: React.CSSProperties = {
  borderRadius: 10,
  border: '1px solid #34d399',
  background: 'rgba(6, 95, 70, 0.9)',
  color: '#ecfdf5',
  padding: '10px 14px',
  cursor: 'pointer',
  fontWeight: 800
};

export function PhotoCaptureSoftwareTestPanel() {
  const [result, setResult] = useState<PhotoCaptureSoftwareSelfTestSummary | null>(null);

  const runSelfTest = () => {
    setResult(runPhotoCaptureSoftwareSelfTest());
  };

  return (
    <section style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: '#f8fafc' }}>
            Software Self Test（ソフトウェア自己検査）
          </h2>
          <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: 14 }}>
            カメラ・フットペダルなしで、入力経路とPhoto QA（写真品質検査）の基本動作を自動確認します。
          </p>
        </div>
        <button type="button" style={buttonStyle} onClick={runSelfTest}>
          自己検査を実行
        </button>
      </div>

      {!result ? (
        <p style={{ margin: '14px 0 0', color: '#64748b' }}>
          未実行です。実機購入前でも何度でも実行できます。
        </p>
      ) : (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 900, color: result.overallStatus === 'PASS' ? '#34d399' : '#f87171' }}>
            {result.overallStatus === 'PASS'
              ? `PASS｜${result.passed}/${result.checks.length} 項目正常`
              : `FAIL｜${result.failed} 項目に問題があります`}
          </div>

          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            {result.checks.map((check) => (
              <div
                key={check.id}
                style={{
                  padding: 10,
                  borderRadius: 10,
                  background: 'rgba(30, 41, 59, 0.75)',
                  border: `1px solid ${check.status === 'PASS' ? 'rgba(52, 211, 153, 0.28)' : 'rgba(248, 113, 113, 0.35)'}`
                }}
              >
                <div style={{ fontWeight: 800, color: check.status === 'PASS' ? '#34d399' : '#f87171' }}>
                  {check.status}｜{check.labelJa}
                </div>
                <div style={{ marginTop: 4, color: '#cbd5e1', fontSize: 13 }}>{check.details}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 12, color: '#fbbf24', fontSize: 13 }}>
            Hardware Validation（実機検証）: {result.hardwareValidationStatus}。この自己検査がPASSでも、未購入の実機を検証済みとは扱いません。
          </div>
        </div>
      )}
    </section>
  );
}
