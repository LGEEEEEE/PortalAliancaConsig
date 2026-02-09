// =========================================================================
// CONFIGURAÇÃO INICIAL E BIBLIOTECAS
// =========================================================================

// Define o worker do PDF.js (Necessário para renderizar o PDF no navegador)
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// Variáveis de Estado Global
let currentFile = null;
let currentMode = 'optimize'; // 'optimize' ou 'sign'
let sigMode = 'text'; // 'text' ou 'image'
let pdfScaleRatio = 1; // Fator de correção visual (Tela vs PDF Real)

// Configurações da Assinatura
let sigParams = {
    text: '',
    imageSrc: null,
    rotation: 0,
    fontSize: 40,
    color: { r: 0, g: 0.2, b: 0.5 }, // Azul padrão (#003380)
    finalPosition: null // Onde a assinatura será colada { pageIndex, xRatio, yRatio }
};

// Referências aos elementos do HTML (Cache do DOM)
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
    statusText: document.getElementById('status-text'),
    modeSelector: document.getElementById('mode-selector'),
    mainWorkspace: document.getElementById('main-workspace')
};

// =========================================================================
// EVENTOS DE INICIALIZAÇÃO E UI
// =========================================================================

window.addEventListener('load', () => {
    // Recupera assinatura salva no navegador para facilitar
    const savedName = localStorage.getItem('assinatura_salva');
    if (savedName) {
        elements.sigNameInput.value = savedName;
        sigParams.text = savedName;
        elements.sigDisplayText.innerText = savedName;
    }
});

// Captura digitação do nome
elements.sigNameInput.oninput = (e) => {
    sigParams.text = e.target.value;
    elements.sigDisplayText.innerText = sigParams.text || "Assinatura";
    localStorage.setItem('assinatura_salva', sigParams.text);
};

// --- NAVEGAÇÃO ENTRE TELAS ---
window.startFlow = (mode) => {
    currentMode = mode;
    elements.modeSelector.classList.add('hidden');
    elements.mainWorkspace.classList.remove('hidden');

    const title = document.getElementById('preview-title-text');
    
    if (mode === 'optimize') {
        // Modo Otimização: Esconde ferramentas de assinatura
        document.getElementById('signature-config').classList.add('hidden');
        elements.draggable.classList.add('hidden');
        document.getElementById('drag-instruction').classList.add('hidden');
        title.innerText = "2. Prévia e Otimização";
        elements.processBtn.innerText = "Comprimir e Baixar PDF";
    } else {
        // Modo Assinatura: Mostra tudo
        document.getElementById('signature-config').classList.remove('hidden');
        document.getElementById('drag-instruction').classList.remove('hidden');
        title.innerText = "3. Posicione e Processe";
        elements.processBtn.innerText = "Assinar e Baixar PDF";
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

// =========================================================================
// DRAG & DROP E LEITURA DE ARQUIVO
// =========================================================================

elements.dropArea.onclick = () => elements.fileInput.click();

elements.dropArea.ondragover = (e) => { 
    e.preventDefault(); 
    elements.dropArea.style.borderColor = '#0056b3'; 
    elements.dropArea.style.backgroundColor = '#f0f9ff';
};

elements.dropArea.ondragleave = () => { 
    elements.dropArea.style.borderColor = '#cbd5e1'; 
    elements.dropArea.style.backgroundColor = '#f8fafc';
};

elements.dropArea.ondrop = (e) => {
    e.preventDefault();
    elements.dropArea.style.borderColor = '#cbd5e1';
    elements.dropArea.style.backgroundColor = '#f8fafc';
    if (e.dataTransfer.files[0]) handlePDF(e.dataTransfer.files[0]);
};

elements.fileInput.onchange = (e) => handlePDF(e.target.files[0]);

async function handlePDF(file) {
    if (file?.type === "application/pdf") {
        currentFile = file;
        document.getElementById('file-name').innerText = file.name;
        document.getElementById('file-size-original').innerText = (file.size / 1024 / 1024).toFixed(2) + " MB";
        document.getElementById('file-info').classList.remove('hidden');
        
        // Renderiza a prévia visual
        await renderPreview();
    } else {
        alert("Por favor, envie apenas arquivos PDF.");
    }
}

// =========================================================================
// RENDERIZAÇÃO DA PRÉVIA (VISUALIZAÇÃO)
// =========================================================================

async function renderPreview() {
    const previewSection = document.getElementById('preview-section');
    const wrapper = document.getElementById('pdf-pages-wrapper');
    
    wrapper.innerHTML = ""; // Limpa anterior
    previewSection.classList.remove('hidden');

    // Carrega o PDF na memória para visualização
    const arrayBuffer = await currentFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    // Renderiza todas as páginas (limitado a um visualizador simples)
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.0 });
        
        // CÁLCULO DE ESCALA VISUAL
        // Limitamos a altura da página na tela a 500px para caber no monitor
        const scale = 500 / viewport.height;
        pdfScaleRatio = scale; 

        const scaledViewport = page.getViewport({ scale: scale });

        // Cria o container da página
        const pageDiv = document.createElement('div');
        pageDiv.className = "page-unit";
        pageDiv.dataset.pageNumber = i;

        // Cria o Canvas
        const canvas = document.createElement('canvas');
        canvas.height = scaledViewport.height;
        canvas.width = scaledViewport.width;

        // Desenha o PDF no Canvas
        await page.render({
            canvasContext: canvas.getContext('2d'),
            viewport: scaledViewport
        }).promise;

        pageDiv.appendChild(canvas);
        wrapper.appendChild(pageDiv);
    }

    // Se estiver no modo assinar, ativa o elemento arrastável
    if (currentMode === 'sign') setupDraggable();
}

// =========================================================================
// LÓGICA DE ARRASTAR ASSINATURA (DRAGGABLE)
// =========================================================================

function setupDraggable() {
    elements.draggable.classList.remove('hidden');
    const container = document.getElementById('viewport-container');
    
    // Centraliza assinatura inicialmente
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
        e.preventDefault(); // Evita selecionar texto
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

// Calcula em qual página e em qual posição relativa (0-1) a assinatura soltou
function calculateDropPosition() {
    const sigRect = elements.draggable.getBoundingClientRect();
    
    // Pega o ponto central da assinatura para maior precisão
    const sigCenterX = sigRect.left + sigRect.width / 2;
    const sigCenterY = sigRect.top + sigRect.height / 2;
    
    const pages = document.querySelectorAll('.page-unit canvas');
    let bestMatch = null;

    pages.forEach((canvas) => {
        const rect = canvas.getBoundingClientRect();
        
        // Verifica colisão: O centro da assinatura está dentro desta página?
        if (sigCenterX >= rect.left && sigCenterX <= rect.right &&
            sigCenterY >= rect.top && sigCenterY <= rect.bottom) {
            
            const pageNum = parseInt(canvas.parentElement.dataset.pageNumber);
            
            bestMatch = {
                pageIndex: pageNum,
                // Posição relativa (0% a 100%)
                xRatio: Math.max(0, Math.min(1, (sigRect.left - rect.left) / rect.width)),
                yRatio: Math.max(0, Math.min(1, (sigRect.top - rect.top) / rect.height))
            };
        }
    });

    sigParams.finalPosition = bestMatch;
    
    // Feedback visual (Verde = OK, Vermelho = Fora)
    elements.draggable.style.borderColor = bestMatch ? "#22c55e" : "#ef4444";
}

// =========================================================================
// CONTROLES DE ESTILO (Rotação, Tamanho, Cor)
// =========================================================================

document.getElementById('sig-rotate').oninput = (e) => {
    sigParams.rotation = parseInt(e.target.value);
    document.getElementById('angle-val').innerText = sigParams.rotation;
    elements.draggable.style.transform = `rotate(${sigParams.rotation}deg)`;
};

document.getElementById('sig-size').oninput = (e) => {
    sigParams.fontSize = parseInt(e.target.value);
    document.getElementById('size-val').innerText = sigParams.fontSize;
    
    if (sigMode === 'text') {
        elements.sigDisplayText.style.fontSize = sigParams.fontSize + "px";
    } else {
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
            elements.sigDisplayImg.classList.remove('hidden');
            elements.sigDisplayText.classList.add('hidden');
        };
        reader.readAsDataURL(file);
    }
};

// =========================================================================
// FUNÇÃO MÁGICA: OTIMIZADOR DE IMAGEM (RASTERIZAÇÃO)
// =========================================================================

/**
 * Converte cada página do PDF em imagem e recria um PDF novo.
 * Ideal para documentos escaneados gigantes.
 */
async function compressAndRebuildPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdfSrc = await pdfjsLib.getDocument(arrayBuffer).promise;
    const newPdfDoc = await PDFLib.PDFDocument.create();
    const totalPages = pdfSrc.numPages;
    
    // Configuração de qualidade
    const scale = 2.0; // 2.0 garante boa leitura. 1.0 fica muito serrilhado.
    const quality = 0.6; // 0.6 = 60% qualidade JPEG (Alta compressão)

    for (let i = 1; i <= totalPages; i++) {
        // Atualiza UI
        elements.statusText.innerText = `Processando página ${i} de ${totalPages}...`;
        const percent = Math.round((i / totalPages) * 90);
        elements.progressBar.style.width = `${percent}%`;

        // 1. Renderiza página em Canvas (Memória)
        const page = await pdfSrc.getPage(i);
        const viewport = page.getViewport({ scale: scale });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        await page.render({ canvasContext: context, viewport: viewport }).promise;
        
        // 2. Converte Canvas para JPEG comprimido
        const imgDataUrl = canvas.toDataURL('image/jpeg', quality);
        
        // 3. Insere no novo PDF
        const jpgImage = await newPdfDoc.embedJpg(imgDataUrl);
        const pageDims = jpgImage.scale(1 / scale); // Ajusta tamanho físico
        
        const newPage = newPdfDoc.addPage([pageDims.width, pageDims.height]);
        newPage.drawImage(jpgImage, {
            x: 0, y: 0,
            width: pageDims.width,
            height: pageDims.height,
        });
    }
    
    return await newPdfDoc.save();
}

// =========================================================================
// PROCESSAMENTO FINAL (O GRANDE CLICK)
// =========================================================================

elements.processBtn.onclick = async () => {
    // Validação inicial para modo de assinatura
    if (currentMode === 'sign' && !sigParams.finalPosition) {
        alert("Ops! A assinatura não está sobre nenhuma página. Arraste-a para onde deseja assinar.");
        return;
    }

    // Trava UI
    elements.processBtn.disabled = true;
    elements.progressContainer.classList.remove('hidden');
    elements.statusText.innerText = "Iniciando...";
    elements.progressBar.style.width = "5%";

    try {
        let pdfBytes;

        // --- CAMINHO 1: APENAS OTIMIZAR (RASTERIZAÇÃO) ---
        if (currentMode === 'optimize') {
            // Chama a função nova que refaz o PDF
            pdfBytes = await compressAndRebuildPDF(currentFile);
        
        // --- CAMINHO 2: ASSINAR (PRESERVA TEXTO) ---
        } else {
            elements.statusText.innerText = "Preparando documento...";
            const fileBuffer = await currentFile.arrayBuffer();
            const pdfDoc = await PDFLib.PDFDocument.load(fileBuffer);

            // Carrega fontes/imagens
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
            
            // Aplica assinatura na página correta
            applySignatureToDoc(pdfDoc, fontToUse, imageToUse);
            
            elements.statusText.innerText = "Salvando arquivo...";
            elements.progressBar.style.width = "90%";
            pdfBytes = await pdfDoc.save();
        }

        // --- DOWNLOAD ---
        elements.progressBar.style.width = "100%";
        elements.statusText.innerText = "Download pronto!";
        downloadPDF(pdfBytes);

    } catch (e) {
        console.error(e);
        alert("Erro no processamento: " + e.message);
    } finally {
        // Destrava UI
        elements.processBtn.disabled = false;
        setTimeout(() => {
            elements.progressContainer.classList.add('hidden');
            elements.progressBar.style.width = "0%";
        }, 3000);
    }
};

// Aplica a assinatura (Lógica vetorial do pdf-lib)
function applySignatureToDoc(pdfDoc, font, image) {
    if (!sigParams.finalPosition) return;
    
    const pages = pdfDoc.getPages();
    const { pageIndex, xRatio, yRatio } = sigParams.finalPosition;
    
    // Proteção contra índice inválido
    if (pageIndex > pages.length) return;
    
    const targetPage = pages[pageIndex - 1]; // Array começa em 0, páginas em 1
    const { width, height } = targetPage.getSize();
    
    // Converte coordenadas relativas (%) para pontos PDF
    const pdfX = width * xRatio;
    let pdfY = height - (height * yRatio);

    // Ajuste de escala (Tela -> PDF)
    const correctedFontSize = sigParams.fontSize / pdfScaleRatio;

    if (sigMode === 'text' && font) {
        // Sobe um pouco o texto para alinhar com o cursor do mouse
        pdfY = pdfY - (correctedFontSize * 0.8);
        
        targetPage.drawText(sigParams.text, {
            x: pdfX,
            y: pdfY,
            size: correctedFontSize,
            font: font,
            color: PDFLib.rgb(sigParams.color.r, sigParams.color.g, sigParams.color.b),
            rotate: PDFLib.degrees(-sigParams.rotation)
        });
    } else if (sigMode === 'image' && image) {
        // Ajusta tamanho da imagem
        const imgHeightOnScreen = sigParams.fontSize * 1.5; 
        const imgHeightOnPdf = imgHeightOnScreen / pdfScaleRatio;
        
        const imgDims = image.scaleToFit(10000, imgHeightOnPdf);
        
        targetPage.drawImage(image, {
            x: pdfX,
            y: pdfY - imgDims.height, // Desenha de baixo para cima
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
    
    const prefixo = currentMode === 'optimize' ? 'otimizado_' : 'assinado_';
    link.download = `${prefixo}${currentFile.name}`;
    link.click();
}