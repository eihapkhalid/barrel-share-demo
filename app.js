(() => {
  const main = document.createElement('script');
  main.src = 'main.js';
  main.onload = () => {
    const excelImport = document.createElement('script');
    excelImport.src = 'excel-import.js';
    document.head.appendChild(excelImport);
  };
  document.head.appendChild(main);
})();
