import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReturnClient } from '@/app/gear/return/[rentalId]/ReturnClient';

global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-preview-url');
global.URL.revokeObjectURL = vi.fn();

const DEFAULT_PROPS = {
  rentalId: 'GR-TEST01',
  itemName: 'Surfboard',
  returnSubmitted: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});

// ─── Initial state ────────────────────────────────────────────────────────────

describe('ReturnClient — initial state', () => {
  it('shows the item name in instructions', () => {
    render(<ReturnClient {...DEFAULT_PROPS} />);
    expect(screen.getByText(/Surfboard/)).toBeTruthy();
  });

  it('shows the upload area', () => {
    render(<ReturnClient {...DEFAULT_PROPS} />);
    expect(screen.getByText(/Click to add photos/i)).toBeTruthy();
    expect(screen.getByText(/JPG, PNG, HEIC/i)).toBeTruthy();
  });

  it('renders submit button disabled when no files selected', () => {
    render(<ReturnClient {...DEFAULT_PROPS} />);
    const btn = screen.getByRole('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('does not show success state initially', () => {
    render(<ReturnClient {...DEFAULT_PROPS} />);
    expect(screen.queryByText(/Return received!/i)).toBeNull();
  });
});

// ─── Pre-submitted state ──────────────────────────────────────────────────────

describe('ReturnClient — already submitted', () => {
  it('shows success state when returnSubmitted=true', () => {
    render(<ReturnClient {...DEFAULT_PROPS} returnSubmitted={true} />);
    expect(screen.getByText(/Return received!/i)).toBeTruthy();
    expect(screen.getByText(/48 hours/i)).toBeTruthy();
  });

  it('does not show upload area when already submitted', () => {
    render(<ReturnClient {...DEFAULT_PROPS} returnSubmitted={true} />);
    expect(screen.queryByText(/Click to add photos/i)).toBeNull();
  });
});

// ─── File selection ───────────────────────────────────────────────────────────

describe('ReturnClient — file selection', () => {
  function addFile(filename = 'photo.jpg') {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['img'], filename, { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });
    return file;
  }

  it('enables submit button after a file is selected', async () => {
    render(<ReturnClient {...DEFAULT_PROPS} />);
    addFile();
    await waitFor(() => {
      const btn = screen.getByRole('button') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });
  });

  it('shows singular "1 photo" in button label', async () => {
    render(<ReturnClient {...DEFAULT_PROPS} />);
    addFile();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /1 photo/i })).toBeTruthy();
    });
  });

  it('shows plural "2 photos" when 2 files selected', async () => {
    render(<ReturnClient {...DEFAULT_PROPS} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const files = [
      new File(['img'], 'a.jpg', { type: 'image/jpeg' }),
      new File(['img'], 'b.jpg', { type: 'image/jpeg' }),
    ];
    fireEvent.change(input, { target: { files } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /2 photos/i })).toBeTruthy();
    });
  });

  it('shows image preview after file selection', async () => {
    render(<ReturnClient {...DEFAULT_PROPS} />);
    addFile();
    await waitFor(() => {
      const img = document.querySelector('img') as HTMLImageElement;
      expect(img).toBeTruthy();
      expect(img.src).toContain('blob:mock-preview-url');
    });
  });
});

// ─── Submission ───────────────────────────────────────────────────────────────

describe('ReturnClient — submission', () => {
  function addFileAndGetButton() {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });
    return screen.getByRole('button');
  }

  it('shows "Uploading..." while request is in progress', async () => {
    let resolvePromise!: (v: unknown) => void;
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(resolve => { resolvePromise = resolve; })
    );
    render(<ReturnClient {...DEFAULT_PROPS} />);
    addFileAndGetButton();
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /uploading/i })).toBeTruthy();
    });
    resolvePromise({ ok: true, json: async () => ({ ok: true }) });
  });

  it('shows "Return received!" after successful submission', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    render(<ReturnClient {...DEFAULT_PROPS} />);
    addFileAndGetButton();
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => {
      expect(screen.getByText(/Return received!/i)).toBeTruthy();
    });
  });

  it('POSTs to /api/gear-return with rentalId and photos', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    render(<ReturnClient {...DEFAULT_PROPS} />);
    addFileAndGetButton();
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/gear-return',
        expect.objectContaining({ method: 'POST' })
      );
    });
    const [, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = opts.body as FormData;
    expect(body.get('rentalId')).toBe('GR-TEST01');
    expect(body.getAll('photos')).toHaveLength(1);
  });

  it('shows error message when API returns non-ok response', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Photo upload failed' }),
    });
    render(<ReturnClient {...DEFAULT_PROPS} />);
    addFileAndGetButton();
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => {
      expect(screen.getByText(/Photo upload failed/i)).toBeTruthy();
    });
  });

  it('shows error message when fetch throws', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
    render(<ReturnClient {...DEFAULT_PROPS} />);
    addFileAndGetButton();
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeTruthy();
    });
  });

  it('re-enables submit button after failed submission', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Server error' }),
    });
    render(<ReturnClient {...DEFAULT_PROPS} />);
    addFileAndGetButton();
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => {
      const btn = screen.getByRole('button') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });
  });
});
