pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// --- CONFIGURAÇÃO E ESTADO ---
let currentFile = null;
let currentMode = 'optimize';
let sigMode = 'text';
let pdfScaleRatio = 1; // Variável mágica para corrigir o tamanho

let sigParams = {
    text: '',
    imageSrc: null,
    rotation: 0,
    fontSize: 40,
    color: { r: 0, g: 0.2, b: 0.5 },
    finalPosition: null
};

// --- REFERÊNCIAS DOM ---
const elements = {
    dropArea: document.getElementById('drop-area'),
    fileInput: document.getElementById('file-input'),
    draggable: document.getElementById('draggable-sig'),
    sigDisplayText: document.getElementById('sig-display-text'),
    sigDisplayImg: document.getElementById('sig-display-img'),
    sigNameInput: document.getElementById('sig-name'),
    processBtn: document.getElementById('process-btn'),
    progressBar: document.getElementById('progress-bar'),
    progressContainer: document.getElementById('progress-container'),
    statusText: document.getElementById('status-text')
};

// --- INICIALIZAÇÃO ---
window.addEventListener('load', () => {
    const savedName = localStorage.getItem('assinatura_salva');
    if (savedName) {
        elements.sigNameInput.value = savedName;
        sigParams.text = savedName;
        elements.sigDisplayText.innerText = savedName;
    }
    // Removemos o console de debug preto, pois já "Deu bom"
    const debug = document.getElementById('debug-console');
    if(debug) debug.remove();
});

elements.sigNameInput.oninput = (e) => {
    sigParams.text = e.target.value;
    elements.sigDisplayText.innerText = sigParams.text || "Assinatura";
    localStorage.setItem('assinatura_salva', sigParams.text);
};

// --- NAVEGAÇÃO E ARQUIVOS ---
window.startFlow = (mode) => {
    currentMode = mode;
    document.getElementById('mode-selector').classList.add('hidden');
    document.getElementById('main-workspace').classList.remove('hidden');

    const title = document.getElementById('preview-title-text');
    if (mode === 'optimize') {
        document.getElementById('signature-config').classList.add('hidden');
        elements.draggable.classList.add('hidden');
        title.innerText = "2. Prévia e Otimização";
    } else {
        document.getElementById('signature-config').classList.remove('hidden');
        title.innerText = "3. Posicione e Processe";
    }
};

window.resetFlow = () => location.reload();

window.resetFile = () => {
    currentFile = null;
    elements.fileInput.value = "";
    document.getElementById('file-info').classList.add('hidden');
    document.getElementById('preview-section').classList.add('hidden');
    document.getElementById('pdf-pages-wrapper').innerHTML = "";
};

elements.dropArea.onclick = () => elements.fileInput.click();
elements.dropArea.ondragover = (e) => { e.preventDefault(); elements.dropArea.style.borderColor = '#0056b3'; };
elements.dropArea.ondragleave = () => { elements.dropArea.style.borderColor = '#cbd5e1'; };
elements.dropArea.ondrop = (e) => {
    e.preventDefault();
    elements.dropArea.style.borderColor = '#cbd5e1';
    if (e.dataTransfer.files[0]) handlePDF(e.dataTransfer.files[0]);
};
elements.fileInput.onchange = (e) => handlePDF(e.target.files[0]);

async function handlePDF(file) {
    if (file?.type === "application/pdf") {
        currentFile = file;
        document.getElementById('file-name').innerText = file.name;
        document.getElementById('file-size-original').innerText = (file.size / 1024 / 1024).toFixed(2) + " MB";
        document.getElementById('file-info').classList.remove('hidden');
        await renderPreview();
    } else {
        alert("Por favor, envie um arquivo PDF.");
    }
}

async function renderPreview() {
    const previewSection = document.getElementById('preview-section');
    const wrapper = document.getElementById('pdf-pages-wrapper');
    
    wrapper.innerHTML = "";
    previewSection.classList.remove('hidden');

    const arrayBuffer = await currentFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.0 });
        
        // CÁLCULO MÁGICO DE ESCALA
        // Definimos que a página na tela terá no máximo 500px de altura
        // A escala é: Tamanho_Tela / Tamanho_Real_PDF
        const scale = 500 / viewport.height;
        pdfScaleRatio = scale; // Salvamos isso para usar na hora de salvar o PDF

        const scaledViewport = page.getViewport({ scale: scale });

        const pageDiv = document.createElement('div');
        pageDiv.className = "page-unit";
        pageDiv.dataset.pageNumber = i;

        const canvas = document.createElement('canvas');
        canvas.height = scaledViewport.height;
        canvas.width = scaledViewport.width;

        await page.render({
            canvasContext: canvas.getContext('2d'),
            viewport: scaledViewport
        }).promise;

        pageDiv.appendChild(canvas);
        wrapper.appendChild(pageDiv);
    }

    if (currentMode === 'sign') setupDraggable();
}

// --- DRAGGABLE (ARRASTAR) ---
function setupDraggable() {
    elements.draggable.classList.remove('hidden');
    const container = document.getElementById('viewport-container');
    
    // Centraliza
    elements.draggable.style.left = (container.clientWidth / 2) - 50 + "px";
    elements.draggable.style.top = (container.clientHeight / 2) - 20 + "px";

    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    elements.draggable.onmousedown = (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialLeft = elements.draggable.offsetLeft;
        initialTop = elements.draggable.offsetTop;
        elements.draggable.style.cursor = 'grabbing';
        e.preventDefault();
    };

    document.onmousemove = (e) => {
        if (!isDragging) return;
        elements.draggable.style.left = `${initialLeft + (e.clientX - startX)}px`;
        elements.draggable.style.top = `${initialTop + (e.clientY - startY)}px`;
    };

    document.onmouseup = () => {
        if (isDragging) {
            isDragging = false;
            elements.draggable.style.cursor = 'move';
            calculateDropPosition();
        }
    };
}

function calculateDropPosition() {
    const sigRect = elements.draggable.getBoundingClientRect();
    const sigCenterX = sigRect.left + sigRect.width / 2;
    const sigCenterY = sigRect.top + sigRect.height / 2;
    const pages = document.querySelectorAll('.page-unit canvas');
    let bestMatch = null;

    pages.forEach((canvas) => {
        const rect = canvas.getBoundingClientRect();
        if (sigCenterX >= rect.left && sigCenterX <= rect.right &&
            sigCenterY >= rect.top && sigCenterY <= rect.bottom) {
            const pageNum = parseInt(canvas.parentElement.dataset.pageNumber);
            bestMatch = {
                pageIndex: pageNum,
                // Posição relativa (0% a 100%) dentro da página
                xRatio: Math.max(0, Math.min(1, (sigRect.left - rect.left) / rect.width)),
                yRatio: Math.max(0, Math.min(1, (sigRect.top - rect.top) / rect.height))
            };
        }
    });

    sigParams.finalPosition = bestMatch;
    elements.draggable.style.borderColor = bestMatch ? "#22c55e" : "#ef4444";
}

// --- CONTROLES DA UI ---
document.getElementById('sig-rotate').oninput = (e) => {
    sigParams.rotation = parseInt(e.target.value);
    document.getElementById('angle-val').innerText = sigParams.rotation;
    elements.draggable.style.transform = `rotate(${sigParams.rotation}deg)`;
};

document.getElementById('sig-size').oninput = (e) => {
    sigParams.fontSize = parseInt(e.target.value);
    document.getElementById('size-val').innerText = sigParams.fontSize;
    
    // Atualiza visualmente na tela
    if (sigMode === 'text') {
        elements.sigDisplayText.style.fontSize = sigParams.fontSize + "px";
    } else {
        // Para imagem, usamos uma altura baseada no font-size para manter proporção
        elements.sigDisplayImg.style.height = (sigParams.fontSize * 1.5) + "px";
    }
    
    if (sigParams.finalPosition) calculateDropPosition();
};

window.changeSigColor = (r, g, b, hex) => {
    sigParams.color = { r: r / 255, g: g / 255, b: b / 255 };
    elements.sigDisplayText.style.color = hex;
};

window.switchTab = (mode) => {
    sigMode = mode;
    document.getElementById('tab-text').classList.toggle('active', mode === 'text');
    document.getElementById('tab-image').classList.toggle('active', mode === 'image');
    document.getElementById('area-text').classList.toggle('hidden', mode !== 'text');
    document.getElementById('area-image').classList.toggle('hidden', mode !== 'image');
    if (mode === 'image') {
        elements.sigDisplayText.classList.add('hidden');
        elements.sigDisplayImg.classList.remove('hidden');
    } else {
        elements.sigDisplayText.classList.remove('hidden');
        elements.sigDisplayImg.classList.add('hidden');
    }
};

document.getElementById('sig-input-file').onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
            sigParams.imageSrc = evt.target.result;
            elements.sigDisplayImg.src = evt.target.result;
        };
        reader.readAsDataURL(file);
    }
};

// =========================================================================
// PROCESSAMENTO FINAL (SEM PERDER O PROGRESSO)
// =========================================================================

elements.processBtn.onclick = async () => {
    if (currentMode === 'sign' && !sigParams.finalPosition) {
        alert("Atenção: A assinatura não está sobre nenhuma página.");
        return;
    }

    elements.processBtn.disabled = true;
    elements.progressContainer.classList.remove('hidden');
    elements.statusText.innerText = "Preparando arquivo...";
    elements.progressBar.style.width = "10%";

    try {
        const fileBuffer = await currentFile.arrayBuffer();
        
        // Carrega o documento
        const pdfDoc = await PDFLib.PDFDocument.load(fileBuffer);
        
        if (currentMode === 'sign') {
            elements.statusText.innerText = "Aplicando assinatura...";
            
            // Define a fonte que você gostou (Times Roman Italic)
            let fontToUse = null;
            let imageToUse = null;

            if (sigMode === 'text') {
                fontToUse = await pdfDoc.embedFont(PDFLib.StandardFonts.TimesRomanItalic);
            } else if (sigMode === 'image' && sigParams.imageSrc) {
                if (sigParams.imageSrc.startsWith('data:image/png')) {
                    imageToUse = await pdfDoc.embedPng(sigParams.imageSrc);
                } else {
                    imageToUse = await pdfDoc.embedJpg(sigParams.imageSrc);
                }
            }
            
            // Aplica a assinatura
            applySignatureToDoc(pdfDoc, fontToUse, imageToUse);
        }

        elements.statusText.innerText = "Finalizando e baixando...";
        elements.progressBar.style.width = "90%";
        
        const pdfBytes = await pdfDoc.save();
        downloadPDF(pdfBytes);

        // SUCESSO!
        elements.statusText.innerText = "Download iniciado! Pode editar novamente se quiser.";
        elements.progressBar.style.width = "100%";

    } catch (e) {
        console.error(e);
        alert("Erro inesperado: " + e.message);
    } finally {
        // Reabilita o botão para que a pessoa possa tentar de novo sem recarregar a página
        elements.processBtn.disabled = false;
        
        // Esconde a barra de progresso após 3 segundos, mas mantendo a tela intacta
        setTimeout(() => {
            elements.progressContainer.classList.add('hidden');
            elements.progressBar.style.width = "0%";
        }, 3000);
    }
};

// Função que desenha no PDF corrigindo o tamanho (Size Match)
function applySignatureToDoc(pdfDoc, font, image) {
    if (!sigParams.finalPosition) return;
    
    const pages = pdfDoc.getPages();
    const { pageIndex, xRatio, yRatio } = sigParams.finalPosition;
    
    if (pageIndex > pages.length) return;
    
    const targetPage = pages[pageIndex - 1];
    const { width, height } = targetPage.getSize();
    
    // Converte posição relativa para coordenadas do PDF
    const pdfX = width * xRatio;
    let pdfY = height - (height * yRatio);

    // CORREÇÃO DE TAMANHO:
    // Dividimos o tamanho da tela (px) pela escala para obter o tamanho em pontos PDF
    const correctedFontSize = sigParams.fontSize / pdfScaleRatio;

    if (sigMode === 'text' && font) {
        // Ajuste fino para o texto ficar alinhado verticalmente com o mouse
        pdfY = pdfY - (correctedFontSize * 0.8);
        
        targetPage.drawText(sigParams.text, {
            x: pdfX,
            y: pdfY,
            size: correctedFontSize, // Usando o tamanho corrigido
            font: font,
            color: PDFLib.rgb(sigParams.color.r, sigParams.color.g, sigParams.color.b),
            rotate: PDFLib.degrees(-sigParams.rotation)
        });
    } else if (sigMode === 'image' && image) {
        // Ajuste também para imagem
        const imgHeightOnScreen = sigParams.fontSize * 1.5; 
        const imgHeightOnPdf = imgHeightOnScreen / pdfScaleRatio; // Aplica correção
        
        const imgDims = image.scaleToFit(10000, imgHeightOnPdf); // Escala mantendo proporção baseada na altura
        
        targetPage.drawImage(image, {
            x: pdfX,
            y: pdfY - imgDims.height,
            width: imgDims.width,
            height: imgDims.height,
            rotate: PDFLib.degrees(-sigParams.rotation)
        });
    }
}

function downloadPDF(pdfBytes) {
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${currentFile.name.replace('.pdf', '')}_assinado.pdf`;
    link.click();
}