'use client';

import { useState, useRef } from 'react';
import styles from './return.module.css';

interface Props {
  rentalId: string;
  itemName: string;
  returnSubmitted: boolean;
}

export function ReturnClient({ rentalId, itemName, returnSubmitted: initialSubmitted }: Props) {
  const [submitted, setSubmitted] = useState(initialSubmitted);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(incoming: FileList | null) {
    if (!incoming) return;
    const arr = Array.from(incoming).slice(0, 6 - files.length);
    const newFiles = [...files, ...arr];
    setFiles(newFiles);
    const newPreviews = newFiles.map(f => URL.createObjectURL(f));
    setPreviews(newPreviews);
  }

  async function handleSubmit() {
    if (files.length === 0) {
      setError('Please add at least one photo of the returned gear.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('rentalId', rentalId);
      files.forEach(f => fd.append('photos', f));

      const res = await fetch('/api/gear-return', { method: 'POST', body: fd });
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
      <div className={styles.successBox}>
        <div className={styles.successIcon}>
          <i className="bi-shield-check" />
        </div>
        <h2 className={styles.successTitle}>Return received!</h2>
        <p className={styles.successSub}>
          We will inspect the gear and release your $20 deposit within 48 hours.
          You&apos;ll see the refund on your card automatically.
        </p>
      </div>
    );
  }

  return (
    <>
      <p className={styles.sub}>
        Place the {itemName} back in the locker, then upload 2–6 photos showing the gear
        in good condition. We&apos;ll release your $20 deposit within 48 hours.
      </p>

      <div
        className={styles.uploadArea}
        onClick={() => inputRef.current?.click()}
      >
        <div className={styles.uploadIcon}>
          <i className="bi-cloud-upload" />
        </div>
        <p className={styles.uploadText}>Click to add photos</p>
        <p className={styles.uploadNote}>JPG, PNG, HEIC — up to 6 photos</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={e => handleFiles(e.target.files)}
        />
      </div>

      {previews.length > 0 && (
        <div className={styles.previews}>
          {previews.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt={`Photo ${i + 1}`} className={styles.preview} />
          ))}
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      <button
        className={`btn-primary ${styles.submitBtn}`}
        onClick={handleSubmit}
        disabled={loading || files.length === 0}
      >
        {loading
          ? 'Uploading...'
          : `Submit return${files.length > 0 ? ` (${files.length} photo${files.length > 1 ? 's' : ''})` : ''}`}
      </button>
    </>
  );
}
