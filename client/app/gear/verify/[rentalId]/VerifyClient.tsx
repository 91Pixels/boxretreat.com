'use client';
import { useState } from 'react';
import styles from './verify.module.css';

const ID_TYPES = [
  { value: 'passport', label: 'Passport' },
  { value: 'driver_license', label: "Driver's License" },
  { value: 'cedula', label: 'Cédula de Identidad' },
  { value: 'other', label: 'Other Government ID' },
];

interface Props {
  rentalId: string;
  itemName: string;
  alreadySubmitted: boolean;
}

export function VerifyClient({ rentalId, itemName, alreadySubmitted }: Props) {
  const [submitted, setSubmitted] = useState(alreadySubmitted);
  const [idType, setIdType] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  }

  async function handleSubmit() {
    if (!idType || !idNumber.trim() || !photo) {
      setError('Please fill all fields and upload your ID photo.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('rentalId', rentalId);
      fd.append('idType', idType);
      fd.append('idNumber', idNumber.trim());
      fd.append('photo', photo);
      const res = await fetch('/api/gear-submit-id', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setSubmitted(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <main className={styles.wrap}>
        <div className={styles.card}>
          <div className={styles.iconWrap}>🔐</div>
          <h1 className={styles.title}>ID Submitted!</h1>
          <p className={styles.sub}>
            We&apos;re reviewing your identity. You&apos;ll receive an email with your locker
            number and access code within a few minutes.
          </p>
          <p className={styles.rentalId}>Rental ID: <code>{rentalId}</code></p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>Verify Your Identity</h1>
        <p className={styles.sub}>
          To complete your <strong>{itemName}</strong> rental, please provide a valid
          government-issued ID.
        </p>

        <div className={styles.field}>
          <label className={styles.label}>ID Type</label>
          <select
            className={styles.select}
            value={idType}
            onChange={e => setIdType(e.target.value)}
          >
            <option value="">Select ID type…</option>
            {ID_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>ID Number</label>
          <input
            className={styles.input}
            type="text"
            placeholder="Enter your ID number"
            value={idNumber}
            onChange={e => setIdNumber(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>ID Photo</label>
          <input
            className={styles.fileInput}
            type="file"
            accept="image/*"
            onChange={handlePhoto}
          />
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="ID preview" className={styles.preview} />
          )}
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button
          className={styles.btn}
          onClick={handleSubmit}
          disabled={loading || !idType || !idNumber || !photo}
        >
          {loading ? 'Submitting…' : 'Submit ID & Continue'}
        </button>
      </div>
    </main>
  );
}
