// Configuração do Worker do PDF.js (Obrigatório para funcionar)
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

const dropArea = document.getElementById('drop-area');
const fileInput = document.getElementById('file-input');
const compressBtn = document.getElementById('compress-btn');
const status = document.getElementById('status');
const fileInfo = document.getElementById('file-info');

let currentFile = null;

// --- Lógica de Interface (Arraste e Clique) ---

// Abrir seletor ao clicar
dropArea.onclick = () => fileInput.click();

// Quando seleciona via seletor
fileInput.onchange = (e) => handleFile(e.target.files[0]);

// Efeitos de Arrastar (Drag and Drop)
['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropArea.classList.add('highlight');
    }, false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropArea.classList.remove('highlight');
    }, false);
});

// Quando solta o arquivo
dropArea.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    handleFile(dt.files[0]);
}, false);

function handleFile(file) {
    if (file && file.type === "application/pdf") {
        currentFile = file;
        document.getElementById('file-name').innerText = `Arquivo: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
        fileInfo.classList.remove('hidden');
        status.innerText = "";
    } else {
        alert("Por favor, selecione um arquivo PDF.");
    }
}

// --- Lógica de Compressão ---

async function compressPDF() {
    if (!currentFile) return;
    
    status.innerText = "Processando páginas... Por favor, aguarde.";
    compressBtn.disabled = true;

    try {
        const arrayBuffer = await currentFile.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const outPdfDoc = await PDFLib.PDFDocument.create();

        for (let i = 1; i <= pdfDoc.numPages; i++) {
            status.innerText = `Processando página ${i} de ${pdfDoc.numPages}...`;
            const page = await pdfDoc.getPage(i);
            
            // Renderiza a página em um canvas
            const viewport = page.getViewport({ scale: 1.5 }); // Aumentei um pouco o scale para manter legibilidade
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport: viewport }).promise;

            // Transforma em JPEG com 40% de qualidade (Ajuste aqui se quiser mais/menos compressão)
            const imageData = canvas.toDataURL('image/jpeg', 0.4); 
            const image = await outPdfDoc.embedJpg(imageData);

            const newPage = outPdfDoc.addPage([viewport.width, viewport.height]);
            newPage.drawImage(image, { x: 0, y: 0, width: viewport.width, height: viewport.height });
        }

        const pdfBytes = await outPdfDoc.save();
        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        
        // Download
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `comprimido_${currentFile.name}`;
        link.click();
        
        status.innerText = `Concluído! Tamanho final: ${(blob.size / 1024 / 1024).toFixed(2)} MB`;
    } catch (error) {
        console.error(error);
        status.innerText = "Erro ao processar o PDF.";
    } finally {
        compressBtn.disabled = false;
    }
}

compressBtn.onclick = compressPDF;