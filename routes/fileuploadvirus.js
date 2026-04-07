const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pug = require('pug');

// --- 1. LÄS IN DIN MASTERFRAME & PUG ---
const readHTML = require('../readHTML.js');
const pug_loggedinmenu = pug.compileFile('./masterframe/loggedinmenu.html');

var htmlHead = readHTML('./masterframe/head.html');
var htmlHeader = readHTML('./masterframe/header.html');
var htmlMenu = readHTML('./masterframe/menu.html');    
var htmlInfoStart = readHTML('./masterframe/infoStart.html');
var htmlInfoStop = readHTML('./masterframe/infoStop.html');
var htmlFooter = readHTML('./masterframe/footer.html');
var htmlBottom = readHTML('./masterframe/bottom.html');

// --- 2. SÄKERHETSKOLL ---
const checkAuth = (request, response, next) => {
    if (request.session.loggedin) {
        next(); 
    } else {
        response.status(401).send("<h1>Access Denied</h1><p>You must be logged in to access Tricell Research Data.</p>");
    }
};

// --- 3. MULTER KONFIGURATION (Filhantering) ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const virusId = req.params.id;
        const safeVirusId = String(virusId).replace(/[^a-zA-Z0-9_-]/g, ''); 
        const uploadPath = path.join(__dirname, '..', 'data', safeVirusId, 'attachments');
        
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '');
        cb(null, `${Date.now()}-${baseName}${ext}`);
    }
});
const upload = multer({ storage: storage });

// --- 4. ROUTE: POST (Tar emot filen) ---
router.post('/:id', upload.single('fileadd'), function (request, response) {
    const targetid = request.params.id;
    console.log(`Fil uppladdad för virus ID: ${targetid}`);
    response.redirect(`/api/virusdatabase/${targetid}`);
});

// --- 5. ROUTE: GET (Visar uppladdningssidan) ---
router.get('/:id', checkAuth, (request, response) => {
    const idForFile = request.params.id;
    
    // Innehållet i mitten av sidan - Designad för att matcha dina screenshots
    const newdata = `
    <style>
        #newDatacontainer { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; }
        .blue-box { 
            background-color: #f4f7f9; 
            border: 1px solid #ced4da; 
            padding: 25px; 
            margin-top: 20px;
            border-left: 5px solid #5B7DB1;
        }
        .upload-btn { 
            background-color: #5B7DB1; 
            color: white; 
            padding: 8px 20px; 
            border: none; 
            border-radius: 4px; 
            cursor: pointer; 
            font-weight: bold;
        }
        .upload-btn:hover { background-color: #4a6691; }
        .cancel-link { color: #dc3545; text-decoration: none; margin-left: 15px; font-size: 0.9em; }
    </style>

    <div id="newDatacontainer">
        <h1><i class="fa-solid fa-file-shield"></i> Virus Database: Attachment System</h1>
        <p>Currently modifying Research Object: <strong>${idForFile}</strong></p>
        
        <div class="blue-box">
            <form action="/api/fileuploadvirus/${idForFile}" method="POST" enctype="multipart/form-data">
                <label for="fileadd"><strong>Select encrypted file or research image:</strong></label><br><br>
                <input type="file" name="fileadd" id="fileadd" required /><br><br>
                <hr style="border: 0; border-top: 1px solid #dee2e6;"><br>
                <button type="submit" class="upload-btn">
                    <i class="fa-solid fa-upload"></i> Confirm Upload
                </button>
                <a href="/api/virusdatabase/${idForFile}" class="cancel-link">
                    <i class="fa-solid fa-ban"></i> Abort Mission
                </a>
            </form>
        </div>
    </div>`;

    // --- RITA UT SIDAN (Masterframe-metoden) ---
    // VIKTIGT: charset=utf-8 gör att ikonerna visas rätt!
    response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
    
    response.write(htmlHead);

    // Hantera inloggningsmenyn (den lilla gröna rutan uppe till höger i dina bilder)
    if(request.session.loggedin) {
        var htmlLoggedinMenuCSS = readHTML('./masterframe/loggedinmenu_css.html');
        var htmlLoggedinMenuJS = readHTML('./masterframe/loggedinmenu_js.html');
        
        response.write(htmlLoggedinMenuCSS);
        response.write(htmlLoggedinMenuJS);
        response.write(pug_loggedinmenu({
            employeecode: request.cookies.employeecode,
            name: request.cookies.name,
            logintimes: request.cookies.logintimes,
            lastlogin: request.cookies.lastlogin,
            securityaccesslevel: request.session.securityAccessLevel
        }));
    }

    response.write(htmlHeader);
    response.write(htmlMenu);
    response.write(htmlInfoStart);
    
    response.write(newdata); // Här laddas formuläret in
    
    response.write(htmlInfoStop);
    response.write(htmlFooter);
    response.write(htmlBottom);
    response.end();
});

module.exports = router;