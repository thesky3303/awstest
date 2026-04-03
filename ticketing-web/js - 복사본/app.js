function showSection(name) {
  document.querySelectorAll('.page-section').forEach(section => {
    section.classList.remove('active');
  });

  const target = document.getElementById(name + '-section');
  if (target) {
    target.classList.add('active');
  }
}