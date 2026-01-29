const dropArea = document.getElementById('drop-area');
const fileInput = document.getElementById('file-input');
const compressBtn = document.getElementById('compress-btn');
const status = document.getElementById('status');

let currentFile = null;

// Acionar seletor de arquivo ao clicar na área
dropArea.onclick = () => fileInput.click();

fileInput.onchange = (e) => handleFile(e.target.files[0]);

function handleFile(file) {
    if (file && file.type === "application/pdf") {
        currentFile = file;
        document.getElementById('file-name').innerText = `Arquivo: ${file.name}`;
        document.getElementById('file-info').classList.remove('hidden');
    } else {
        alert("Por favor, selecione um arquivo PDF válido.");
    }
}

async function compressPDF() {
    status.innerText = "Processando... aguarde.";
    
    const arrayBuffer = await currentFile.arrayBuffer();
    
    // Carrega o PDF
    const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
    
    /* Nota Técnica: A compressão no navegador é limitada. 
       A pdf-lib otimiza a estrutura do arquivo ao salvar.
       Para compressão agressiva de imagens, seria necessário extrair cada imagem, 
       redimensionar via Canvas API e reinserir no PDF.
    */
    
    const pdfBytes = await pdfDoc.save({
        useObjectStreams: true, // Agrupa objetos para reduzir tamanho
        addDefaultPage: false
    });

    // Criar link de download
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `otimizado_${currentFile.name}`;
    link.click();
    
    status.innerText = "Concluído!";
}

compressBtn.onclick = compressPDF;