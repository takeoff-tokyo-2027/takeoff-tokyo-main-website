import { useEffect, useRef, useState } from 'react';
import { TakeoffButton, TakeoffInput } from '@takeoff-tokyo/ui';
import { api } from './client';

interface ScanResult {
  admitted: boolean;
  alreadyCheckedIn?: boolean;
  checkedInAt: string;
  type?: string;
  name?: string;
}
export function Scanner() {
  const video = useRef<HTMLVideoElement>(null);
  const stop = useRef<(() => void) | null>(null);
  const busyRef = useRef(false);
  const [manual, setManual] = useState('');
  const [camera, setCamera] = useState(false);
  const [message, setMessage] = useState('Ready to scan.');
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  async function scan(credential: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setSuccess(false);
    stop.current?.();
    setCamera(false);
    try {
      const result = await api<ScanResult>('/checkins', 'POST', { credential: credential.trim() });
      setSuccess(result.admitted);
      setMessage(
        result.admitted
          ? `Admitted: ${result.name} · ${result.type}`
          : `Already checked in at ${new Date(result.checkedInAt).toLocaleString()}. Do not admit again.`,
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }
  useEffect(() => {
    if (!camera) return;
    let canceled = false;
    let cancelCamera: (() => void) | null = null;
    void import('@zxing/browser')
      .then(async ({ BrowserQRCodeReader }) => {
        if (canceled || !video.current) return;
        const reader = new BrowserQRCodeReader();
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: 'environment' }, audio: false },
          video.current,
          (result) => {
            if (result && !canceled) void scan(result.getText());
          },
        );
        cancelCamera = () => controls.stop();
        stop.current = cancelCamera;
        if (canceled) controls.stop();
      })
      .catch((e) => {
        if (!canceled) {
          setMessage(`Camera unavailable: ${e.message}. Paste the credential below instead.`);
          setCamera(false);
        }
      });
    return () => {
      canceled = true;
      cancelCamera?.();
    };
  }, [camera]);
  return (
    <section className="ticket-form scanner-form">
      <h1>Check-in</h1>
      <p role="status" className={success ? 'ticket-success' : 'ticket-notice'}>
        {message}
      </p>
      {camera && <video className="ticket-camera" ref={video} muted playsInline />}
      <TakeoffButton
        variant="cyan"
        disabled={busy}
        onClick={() => {
          setSuccess(false);
          setCamera(!camera);
        }}
      >
        {camera ? 'Stop camera' : 'Scan next ticket'}
      </TakeoffButton>
      <form
        className="ticket-form"
        onSubmit={(e) => {
          e.preventDefault();
          void scan(manual);
        }}
      >
        <label>
          Or paste QR credential
          <TakeoffInput value={manual} onChange={(e) => setManual(e.target.value)} required />
        </label>
        <TakeoffButton variant="secondary" type="submit" disabled={busy}>
          Check in
        </TakeoffButton>
      </form>
    </section>
  );
}
