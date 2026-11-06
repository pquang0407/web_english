const $ = (selector) => document.querySelector(selector);
const question = $('#question'), button = $('#feedbackButton'), message = $('#message'), feedback = $('#feedback');
const hints = { 1: 'Part 1 · Trả lời ngắn gọn, tự nhiên trong khoảng 2–3 câu.', 2: 'Part 2 · Chuẩn bị ý trong 1 phút, sau đó nói liên tục khoảng 1–2 phút.', 3: 'Part 3 · Trả lời sâu hơn: nêu quan điểm, giải thích và đưa ví dụ.' };
const examples = { 1: 'What do you like to do in your free time?', 2: 'Describe a place you enjoy visiting. You should say where it is, when you go there, what you do there, and explain why you like it.', 3: 'How has technology changed the way people spend their free time?' };
const guides = { 1: '<strong>Introduction & Interview</strong>Trả lời trực tiếp câu hỏi, rồi thêm một lý do hoặc ví dụ ngắn.', 2: '<strong>Long Turn · Cue Card</strong>Nhập toàn bộ đề Cue Card vào ô câu hỏi, gồm các gợi ý “You should say”.<ul><li>Chuẩn bị ý trong 1 phút bằng đồng hồ bên dưới.</li><li>Ghi âm bài nói khoảng 1–2 phút.</li></ul>', 3: '<strong>Discussion</strong>Nhập một câu hỏi mở rộng từ chủ đề Part 2. Nêu quan điểm, giải thích nguyên nhân và đưa ví dụ hoặc so sánh.' };
let part = 1, drafts = { 1: '', 2: '', 3: '' }, recorder = null, stream = null, chunks = [], audioBlob = null, audioUrl = null, recordingInterval = null, recordingSeconds = 0;
let timerId = null, timerMode = 'prep', secondsLeft = 60;
try {
  const saved = JSON.parse(localStorage.getItem('speakly-draft') || '{}');
  if ([1, 2, 3].includes(saved.part)) part = saved.part;
  for (const key of [1, 2, 3]) drafts[key] = saved.drafts?.[key]?.question || (key === part ? saved.question || '' : '');
} catch {}
function save() {
  drafts[part] = question.value;
  try { localStorage.setItem('speakly-draft', JSON.stringify({ part, drafts: Object.fromEntries([1, 2, 3].map((key) => [key, { question: drafts[key] }])) })); } catch {}
  $('#questionCount').textContent = `${question.value.length} / 1000`;
}
function showMessage(text) { message.textContent = text; message.hidden = !text; }
function formatTime(seconds) { return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
function updateTimer() { $('#timerDisplay').textContent = formatTime(secondsLeft); $('#timerLabel').textContent = timerMode === 'prep' ? 'CHUẨN BỊ Ý' : 'THỜI GIAN NÓI'; }
function resetTimer() { clearInterval(timerId); timerId = null; timerMode = 'prep'; secondsLeft = 60; $('#timerPanel').hidden = part !== 2; $('#timerStart').textContent = 'Bắt đầu'; updateTimer(); }
function startTimer() {
  if (timerId) { clearInterval(timerId); timerId = null; $('#timerStart').textContent = 'Tiếp tục'; return; }
  if (secondsLeft === 0) { timerMode = 'prep'; secondsLeft = 60; }
  $('#timerStart').textContent = 'Tạm dừng';
  timerId = setInterval(() => {
    secondsLeft -= 1;
    if (secondsLeft <= 0) {
      clearInterval(timerId); timerId = null;
      if (timerMode === 'prep') { timerMode = 'speak'; secondsLeft = 120; $('#timerStart').textContent = 'Bắt đầu nói'; }
      else { secondsLeft = 0; $('#timerStart').textContent = 'Làm lại'; }
    }
    updateTimer();
  }, 1000);
}
function discardRecording() {
  if (recorder?.state === 'recording') { recorder.onstop = null; recorder.stop(); }
  stream?.getTracks().forEach((track) => track.stop());
  clearInterval(recordingInterval); audioBlob = null; chunks = [];
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  audioUrl = null; $('#audioPreview').removeAttribute('src'); $('#audioPreview').hidden = true; $('#discardButton').hidden = true;
  $('#recordingTitle').textContent = 'Sẵn sàng ghi âm'; $('#recordingHelp').textContent = 'Nhấn bắt đầu, nói bằng tiếng Anh rồi nhấn dừng.';
  $('#recordingTime').textContent = '00:00'; $('#recordButton').textContent = '●  Bắt đầu ghi âm'; $('#recordButton').classList.remove('is-recording'); $('#recordingLength').textContent = 'Tối đa 3 phút';
}
function selectPart(next) {
  if (next !== part) { drafts[part] = question.value; discardRecording(); feedback.hidden = true; showMessage(''); }
  part = next; question.value = drafts[part];
  document.querySelectorAll('.part-tab').forEach((tab) => { const selected = Number(tab.dataset.part) === part; tab.classList.toggle('selected', selected); tab.setAttribute('aria-selected', String(selected)); });
  $('#partHint').textContent = hints[part]; $('#partGuide').innerHTML = guides[part];
  question.placeholder = part === 2 ? 'Ví dụ: Describe a place you enjoy visiting. You should say where it is...' : part === 3 ? 'Ví dụ: How has technology changed the way people spend their free time?' : 'Ví dụ: What do you like to do in your free time?';
  resetTimer(); save();
}
async function startRecording() {
  showMessage('');
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { showMessage('Trình duyệt này chưa hỗ trợ ghi âm. Hãy mở web bằng Chrome hoặc Edge trên HTTPS.'); return; }
  discardRecording();
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch { showMessage('Không truy cập được micro. Hãy cho phép trình duyệt dùng micro rồi thử lại.'); return; }
  const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type));
  recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  chunks = [];
  recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
  recorder.onstop = () => {
    stream?.getTracks().forEach((track) => track.stop()); stream = null;
    if (!chunks.length) return;
    audioBlob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
    audioUrl = URL.createObjectURL(audioBlob); $('#audioPreview').src = audioUrl; $('#audioPreview').hidden = false; $('#discardButton').hidden = false;
    $('#recordingTitle').textContent = 'Đã ghi âm xong'; $('#recordingHelp').textContent = 'Nghe lại bài nói, sau đó nhận nhận xét.';
    $('#recordButton').textContent = '●  Ghi âm lại'; $('#recordButton').classList.remove('is-recording'); $('#recordingLength').textContent = `${formatTime(recordingSeconds)} đã ghi`;
  };
  recorder.start(1000); recordingSeconds = 0;
  $('#recordingTitle').textContent = 'Đang ghi âm...'; $('#recordingHelp').textContent = 'Nói rõ ràng bằng tiếng Anh. Nhấn dừng khi hoàn tất.';
  $('#recordButton').textContent = '■  Dừng ghi âm'; $('#recordButton').classList.add('is-recording');
  recordingInterval = setInterval(() => { recordingSeconds += 1; $('#recordingTime').textContent = formatTime(recordingSeconds); if (recordingSeconds >= 180) stopRecording(); }, 1000);
}
function stopRecording() { if (recorder?.state === 'recording') recorder.stop(); clearInterval(recordingInterval); }
function addCard(container, title, body, className = '') {
  const card = document.createElement('div'); card.className = `feedback-card ${className}`;
  const heading = document.createElement('h3'); heading.textContent = title;
  const paragraph = document.createElement('p'); paragraph.textContent = body || 'Chưa có nhận xét.';
  card.append(heading, paragraph); container.append(card);
}
function renderFeedback(data) {
  const content = $('#feedbackContent'); content.replaceChildren(); const grid = document.createElement('div'); grid.className = 'feedback-grid';
  addCard(grid, '◉  Nội dung đã nghe', data.transcript, 'wide'); addCard(grid, '✦  Nhận xét chung', data.overall, 'wide');
  addCard(grid, '✓  Trả lời đúng trọng tâm?', data.relevance); addCard(grid, '✎  Ngôn ngữ & cách nói', data.language);
  addCard(grid, '↗  Cách cải thiện', data.improvement, 'wide'); addCard(grid, '“  Câu trả lời tham khảo', data.example, 'wide example');
  content.append(grid); $('#feedbackPart').textContent = `PART ${part}`; feedback.hidden = false; feedback.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
async function convertToWav(blob) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error('Trình duyệt không chuyển được audio. Hãy thử Safari phiên bản mới hơn.');
  const context = new AudioContextClass();
  let decoded;
  try { decoded = await context.decodeAudioData(await blob.arrayBuffer()); }
  catch { throw new Error('Không đọc được bản ghi âm từ iPhone. Hãy ghi lại bằng Safari.'); }
  finally { await context.close().catch(() => {}); }
  const sampleRate = 16000;
  const samples = Math.ceil(decoded.duration * sampleRate);
  const output = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(output);
  const writeText = (offset, value) => { for (let index = 0; index < value.length; index++) view.setUint8(offset + index, value.charCodeAt(index)); };
  writeText(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); writeText(8, 'WAVE'); writeText(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  writeText(36, 'data'); view.setUint32(40, samples * 2, true);
  const channels = Array.from({ length: decoded.numberOfChannels }, (_, index) => decoded.getChannelData(index));
  for (let index = 0; index < samples; index++) {
    const position = index * decoded.sampleRate / sampleRate;
    const before = Math.min(Math.floor(position), decoded.length - 1);
    const after = Math.min(before + 1, decoded.length - 1);
    const fraction = position - before;
    let sample = 0;
    for (const channel of channels) sample += channel[before] * (1 - fraction) + channel[after] * fraction;
    sample = Math.max(-1, Math.min(1, sample / channels.length));
    view.setInt16(44 + index * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
  }
  return new Blob([output], { type: 'audio/wav' });
}
document.querySelectorAll('.part-tab').forEach((tab) => tab.addEventListener('click', () => selectPart(Number(tab.dataset.part))));
question.addEventListener('input', save);
$('#exampleButton').addEventListener('click', () => { question.value = examples[part]; save(); question.focus(); });
$('#timerStart').addEventListener('click', startTimer); $('#timerReset').addEventListener('click', resetTimer);
$('#recordButton').addEventListener('click', () => recorder?.state === 'recording' ? stopRecording() : startRecording());
$('#discardButton').addEventListener('click', discardRecording);
$('#retryButton').addEventListener('click', () => { $('#recordButton').focus(); $('#recordButton').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
button.addEventListener('click', async () => {
  showMessage('');
  if (!question.value.trim() || !audioBlob) { showMessage('Hãy nhập câu hỏi và ghi âm câu trả lời trước khi nhận nhận xét.'); return; }
  if (location.protocol === 'file:') { showMessage('Bạn có thể ghi âm và nghe lại tại đây. Để Gemini nhận xét, cần chạy web qua Cloudflare Pages và cấu hình GEMINI_API_KEY.'); return; }
  if (audioBlob.size > 12 * 1024 * 1024) { showMessage('Bản ghi âm quá lớn. Hãy ghi lại trong tối đa 3 phút.'); return; }
  button.disabled = true; button.innerHTML = 'Đang nghe và nhận xét <span>◌</span>';
  try {
    button.innerHTML = 'Đang chuẩn bị audio <span>◌</span>';
    const uploadBlob = await convertToWav(audioBlob);
    if (uploadBlob.size > 12 * 1024 * 1024) throw new Error('Bản ghi âm quá lớn. Hãy ghi lại ngắn hơn.');
    button.innerHTML = 'Đang nghe và nhận xét <span>◌</span>';
    const form = new FormData(); form.append('part', String(part)); form.append('question', question.value.trim());
    form.append('audio', uploadBlob, 'answer.wav');
    const response = await fetch('/api/feedback', { method: 'POST', body: form }); const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Không thể nhận nhận xét lúc này.');
    renderFeedback(data);
  } catch (error) { showMessage(error.message || 'Có lỗi kết nối. Vui lòng thử lại.'); }
  finally { button.disabled = false; button.innerHTML = 'Nhận nhận xét <span>↗</span>'; }
});
selectPart(part);
