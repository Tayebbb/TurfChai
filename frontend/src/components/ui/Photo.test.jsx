import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Photo } from './Photo';

describe('Photo component', () => {
  it('renders active photo from candidates list', () => {
    const { container } = render(<Photo photos={['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg']} glyph="⚽" />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('src', 'https://example.com/photo1.jpg');
  });

  it('advances to next photo when current photo fails to load', () => {
    const { container } = render(<Photo photos={['https://example.com/broken.jpg', 'https://example.com/valid.jpg']} glyph="⚽" />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', 'https://example.com/broken.jpg');

    // Simulate image error
    fireEvent.error(img);

    const nextImg = container.querySelector('img');
    expect(nextImg).toHaveAttribute('src', 'https://example.com/valid.jpg');
  });

  it('falls back to glyph when all candidate photos fail', () => {
    const { container } = render(<Photo photos={['https://example.com/broken1.jpg', 'https://example.com/broken2.jpg']} glyph="⚽" />);
    const img = container.querySelector('img');

    fireEvent.error(img); // fails photo 1 -> advances to photo 2
    const img2 = container.querySelector('img');
    fireEvent.error(img2); // fails photo 2 -> advances to null

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('⚽');
  });
});
