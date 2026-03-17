"use strict";

const controls = document.querySelectorAll("input[data-control]");

function applyControlValue(controlName, value) {
  const cssVarName = `--${controlName}`;
  document.documentElement.style.setProperty(cssVarName, `${value}px`);

  const output = document.querySelector(`[data-value-for="${controlName}"]`);
  if (output) {
    output.textContent = String(value);
  }
}

for (const input of controls) {
  const controlName = input.dataset.control;
  if (!controlName) {
    continue;
  }

  applyControlValue(controlName, Number(input.value));
  input.addEventListener("input", () => {
    applyControlValue(controlName, Number(input.value));
  });
}
