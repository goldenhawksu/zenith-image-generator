// Same-origin requests carry only the HttpOnly session; provider secrets stay server-side.
export async function generateImage(prompt: string, width: number, height: number): Promise<string> {
  const response = await fetch('/api/generate', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, width, height }),
  });
  if (response.status === 401) {
    window.location.assign('/auth/login');
    throw new Error('Please sign in again');
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Image generation failed');
  if (data.url) return data.url;
  if (data.b64_json) return `data:image/png;base64,${data.b64_json}`;
  throw new Error('No image returned');
}
