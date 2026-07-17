/* Reusable multiple-choice quiz widget for lessons.
   Imports nothing — each lesson is a self-contained HTML file the user can
   open directly without a server or build step. Pair this with assets/quiz.css. */

document.addEventListener('click', function (e) {
  const btn = e.target.closest('.quiz-opts button');
  if (!btn) return;
  const fig = btn.closest('.quiz');
  const key = btn.dataset.k;
  const correct = fig.dataset.correct;
  const explain = fig.dataset.explain || '';
  const feedback = fig.querySelector('.quiz-feedback');
  const opts = fig.querySelectorAll('.quiz-opts button');

  const chosenCorrect = key === correct;
  opts.forEach(o => o.disabled = true);
  btn.classList.add(chosenCorrect ? 'chosen-correct' : 'chosen-wrong');
  if (!chosenCorrect) {
    const right = fig.querySelector('.quiz-opts button[data-k="' + correct + '"]');
    if (right) right.classList.add('reveal-correct');
  }
  feedback.hidden = false;
  feedback.className = 'quiz-feedback ' + (chosenCorrect ? 'ok' : 'no');
  feedback.innerHTML =
    (chosenCorrect ? 'Correct. ' : 'Not quite — ') + explain;
});
