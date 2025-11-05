import * as htmlToImage from 'html-to-image';

function dataURLtoBlob(dataurl: string) {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], { type: mime });
}

export async function exportElementAsImage(el: HTMLElement, filename = 'report.png') {
  const dataUrl = await htmlToImage.toPng(el, { pixelRatio: 2, cacheBust: true, backgroundColor: '#ffffff' });
  const blob = dataURLtoBlob(dataUrl);
  const file = new File([blob], filename, { type: 'image/png' });
  // Try Web Share first (iOS Safari requires user gesture)
  // @ts-ignore
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    // @ts-ignore
    await navigator.share({ files: [file], title: 'Kids Points Report', text: '' }).catch(() => {});
    return;
  }
  // Fallback: download
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
