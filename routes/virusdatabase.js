const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const pug = require('pug');

router.use(express.static('./public'));

// --------------------- Läs in Masterframen & Plugins --------------------------------
const readHTML = require('../readHTML.js');
const pug_loggedinmenu = pug.compileFile('./masterframe/loggedinmenu.html');
const backupVirus = require('../backup.js');

var htmlHead = readHTML('./masterframe/head.html');
var htmlHeader = readHTML('./masterframe/header.html');
var htmlMenu = readHTML('./masterframe/menu.html');    
var htmlInfoStart = readHTML('./masterframe/infoStart.html');
var htmlInfoStop = readHTML('./masterframe/infoStop.html');
var htmlFooter = readHTML('./masterframe/footer.html');
var htmlBottom = readHTML('./masterframe/bottom.html');

var htmlLoggedinMenuCSS = readHTML('./masterframe/loggedinmenu_css.html');
var htmlLoggedinMenuJS = readHTML('./masterframe/loggedinmenu_js.html');

function writeMenu(request, response) {
    if(request.session.loggedin) {
        response.write(htmlLoggedinMenuCSS);
        response.write(htmlLoggedinMenuJS);
        response.write(pug_loggedinmenu({
            employeecode: request.cookies.employeecode,
            name: request.cookies.name,
            logintimes: request.cookies.logintimes,
            lastlogin: request.cookies.lastlogin,
            securityaccesslevel: request.session.securityAccessLevel || request.session.securityaccesslevel // FIX: Menyn får accessnivån!
        }));
    }
}

// ---------------------- Lista alla virus -------------------------------
router.get('/', (request, response) => { 
    const ADODB = require('node-adodb');
    const connection = ADODB.open('Provider=Microsoft.Jet.OLEDB.4.0;Data Source=./data/mdb/researchdata.mdb;');

    async function sqlQuery() {
        try {
            response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
            response.write(htmlHead);
            writeMenu(request, response);
            response.write(htmlHeader);
            response.write(htmlMenu);
            response.write(htmlInfoStart);

            let userLevel = request.session.securityAccessLevel ? request.session.securityAccessLevel.toString().trim().toUpperCase() : "";

            let htmlOutput = `
            <link rel="stylesheet" href="css/researchobjects.css" />
            <style>
                .row-archived { background-color: #e0e0e0 !important; color: #777 !important; }
                .row-archived a { color: #666 !important; }
                .resp-table-row { color: #000; }
            </style>`;

            if(request.session.loggedin) {
                htmlOutput +="<table border=\"0\"><tr><td width=\"350\" align=\"left\"><h2>Research Objects:</h2></td><td width=\"350\" align=\"right\"><a href=\"/api/newvirus\" style=\"color:#336699;text-decoration:none;\">Add new object</a></td></tr></table>";
            } else {
                htmlOutput +="<h2>Research Objects:</h2>\n";
            }

            htmlOutput +="<div id=\"table-resp\"><div id=\"table-header\"><div class=\"table-header-cell-light\">Number</div><div class=\"table-header-cell-dark\">Name</div><div class=\"table-header-cell-light\">Created</div><div class=\"table-header-cell-light\">By</div><div class=\"table-header-cell-light\">Entries</div><div class=\"table-header-cell-light\">Last entry</div>";
            if(request.session.loggedin) {
                htmlOutput +="<div class=\"table-header-cell-light\">Edit</div><div class=\"table-header-cell-light\">Delete</div>";
            }
            htmlOutput +="</div><div id=\"table-body\">\n";

            const result = await connection.query("SELECT ro.id, ro.objectNumber, ro.objectName, ro.objectCreatedDate, ro.objectCreator, ro.objectStatus, (SELECT COUNT(*) FROM ResearchEntries re WHERE CStr(re.researchObjectId) = CStr(ro.id)) AS entryCount, (SELECT MAX(re.entryDate) FROM ResearchEntries re WHERE CStr(re.researchObjectId) = CStr(ro.id)) AS lastEntryDate FROM ResearchObjects ro");
                
            for (let i = 0; i < result.length; i++) {
                const row = result[i]; 

                if (row.objectStatus === 'archive' && userLevel !== 'A') {
                    continue; 
                }

                const archiveClass = (row.objectStatus === 'archive') ? 'row-archived' : '';

                htmlOutput += `<div class="resp-table-row ${archiveClass}">
                    <div class="table-body-cell">${row.objectNumber}</div>
                    <div class="table-body-cell-bigger"><a href="/api/virusdatabase/${row.id}">${row.objectName}</a></div>
                    <div class="table-body-cell">${row.objectCreatedDate}</div>
                    <div class="table-body-cell">${row.objectCreator}</div>
                    <div class="table-body-cell">${row.entryCount || 0}</div>
                    <div class="table-body-cell">${row.lastEntryDate || "-"}</div>`;
                
                if (request.session.loggedin) {
                    htmlOutput += `<div class="table-body-cell"><a href="/api/editvirus/${row.id}" style="color:#336699;text-decoration:none;">E</a></div>
                                   <div class="table-body-cell"><a href="/api/deletevirus/${row.id}" style="color:#336699;text-decoration:none;">D</a></div>`;
                }
                htmlOutput += `</div>\n`;
            }

            htmlOutput += "</div></div>\n\n";
            response.write(htmlOutput); 
            response.write(htmlInfoStop);
            response.write(htmlFooter);
            response.write(htmlBottom);
            response.end();
        } catch (error) {
            console.error("Databasfel:", error);
            response.status(500).send("Database Error: " + error.message);
        }
    }
    sqlQuery();
});

// --------------------- Växla Open/Archive -------------------
router.get('/toggle/:id', async function(request, response) {
    const targetId = request.params.id;
    let userLevel = request.session.securityAccessLevel || "";
    userLevel = userLevel.toString().trim().toUpperCase();

    if (userLevel !== 'A') {
        return response.status(403).send("<h1>Nekat</h1><p>Bara administratörer (A) får göra detta.</p>");
    }

    const ADODB = require('node-adodb');
    const connection = ADODB.open('Provider=Microsoft.Jet.OLEDB.4.0;Data Source=./data/mdb/researchdata.mdb;');

    try {
        const result = await connection.query(`SELECT objectStatus FROM ResearchObjects WHERE id = ${targetId}`);
        if (result.length > 0) {
            const currentStatus = result[0].objectStatus;
            const newStatus = (currentStatus === 'open') ? 'archive' : 'open';
            await connection.execute(`UPDATE ResearchObjects SET objectStatus = '${newStatus}' WHERE id = ${targetId}`);
        }
        response.redirect('/api/virusdatabase/' + targetId);
    } catch (error) {
        response.status(500).send("Update failed.");
    }
});

// --------------------- Läs en virus efter backup -----------------------------
router.get('/backup/:id', async function(request, response) {
    response.redirect('/api/virusdatabase/' + request.params.id);
});

// --------------------- Läs specifik virus (MED FILHANTERING) -----------------------------
router.get('/:id', async function(request, response) {
    const targetId = request.params.id; 
    const ADODB = require('node-adodb');
    const connection = ADODB.open('Provider=Microsoft.Jet.OLEDB.4.0;Data Source=./data/mdb/researchdata.mdb;');
    
    let level = request.session.securityAccessLevel ? request.session.securityAccessLevel.toString().trim().toUpperCase() : "";

    const safeVirusId = String(targetId).replace(/[^a-zA-Z0-9_-]/g, '');
    const dirPath = path.join(__dirname, '..', 'data', safeVirusId, 'attachments');
    let attachmentsHTML = '';

    if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath);
        
        attachmentsHTML = files.map(file => {
            const fullPath = path.join(dirPath, file);
            const stats = fs.statSync(fullPath);
            return `
            <div class='resource-row'>
                <div class='res-label'>Attachment:</div>
                <div class='res-value'>${file} <span style="font-size: 11px; color: #666;">(${(stats.size / 1024).toFixed(1)} KB)</span></div>
                <div class='action-cell'></div>
                <div class='action-cell'>
                    <form method="POST" action="/api/virusdatabase/${safeVirusId}/delete-file" style="display:inline; margin:0;">
                        <input type="hidden" name="fileName" value="${file}">
                        <button type="submit" style="background:none; border:none; cursor:pointer; font-size: 14px; padding:0; margin:0;" title="Delete file">🗑️</button>
                    </form>
                </div>
            </div>`;
        }).join('');
    }

    if (attachmentsHTML === '') {
        attachmentsHTML = `<div class='resource-row'><div class='res-label'>Attachments:</div><div class='res-value'><i>No files attached</i></div></div>`;
    }

    try {
        const result = await connection.query("SELECT id, objectNumber, objectName, objectText, objectCreator, objectCreatedDate, presentationVideoLink, securityVideoLink, objectStatus FROM ResearchObjects WHERE id = " + targetId);
        if (result.length === 0) return response.status(404).send("Hittades inte.");

        const data = result[0];
        const btnText = (data.objectStatus === 'open') ? 'Archive Object' : 'Open Object';

        let toggleUrl = (level === 'A') 
            ? `/api/virusdatabase/toggle/${data.id}` 
            : `javascript:alert('Access denied. Incorrect permissions.');`;

        var htmlOutput = `
        <style>
            .res-container { font-family: sans-serif; padding: 10px; color: #333; width: 100%; box-sizing: border-box; }
            .res-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
            .res-title { font-size: 24px; font-weight: bold; margin: 0; }
            .res-meta { text-align: right; font-size: 14px; }
            .blue-box { background-color: #DDE6F5; border: 2px solid #5B7DB1; padding: 15px; margin: 10px 0; min-height: 80px; }
            .edit-btn { display: inline-block; background-color: #8DA9D4; padding: 6px 30px; border: 2px solid #5B7DB1; font-weight: bold; text-decoration: none; color: black; margin-bottom: 15px; cursor: pointer; margin-right: 5px; }
            .status-tag { font-size: 12px; padding: 2px 8px; border-radius: 4px; background: #eee; border: 1px solid #ccc; margin-left: 10px; vertical-align: middle; text-transform: uppercase; }
            .white-box-container { width: 100%; border: 2px solid black; background-color: white; border-collapse: collapse; margin-top: 15px; padding: 5px; }
            .resource-row { display: flex; align-items: center; border-bottom: 1px solid #ccc; padding: 8px 10px; }
            .res-label { width: 220px; font-weight: bold; flex-shrink: 0; }
            .res-value { flex-grow: 1; overflow: hidden; white-space: nowrap; font-family: monospace; }
            .res-value a { color: black; text-decoration: none; }
            .action-cell { width: 30px; text-align: center; }
            .action-link { color: #336699 !important; font-weight: bold; font-family: Arial, sans-serif; text-decoration: none; }
            .header-container { display: flex; justify-content: flex-end; width: 100%; padding-right: 10px; margin-top: 10px; }
            .rot-text { transform: rotate(-90deg); font-size: 11px; font-weight: bold; width: 30px; text-align: center; height: 20px; }
        </style>

        <div class='res-container'>
            <div class='res-header'>
                <h1 class='res-title'>${data.objectNumber} ${data.objectName} <span class='status-tag'>${data.objectStatus || 'N/A'}</span></h1>
                <div class='res-meta'>
                    <div>Created: ${data.objectCreatedDate}</div>
                    <div>By: ${data.objectCreator}</div>
                </div>
            </div>

            <div class='blue-box'>${data.objectText}</div>
            
            <div style="display:flex; align-items: center; justify-content: space-between; width: 650px;">
                <a href="/api/editvirus/${data.id}"> 
                    <button style="margin-top:10px; padding:6px 14px; background:#4682B4; color:#000; border:1px solid #000; border-radius:0; font-size:12px; font-weight:bold; cursor:pointer;">Edit info</button>
                </a>
                <a href="/api/virusdatabase/backup/${data.id}"> 
                    <button style="margin-top:10px; padding:6px 14px; background:#4682B4; color:#000; border:1px solid #000; border-radius:0; font-size:12px; font-weight:bold; cursor:pointer;">Backup virus</button>
                </a>
            </div>
            
            <br>
            <a href="${toggleUrl}" class='edit-btn'>${btnText}</a>
 
            <div class='header-container'>
                <div class='rot-text'>Edit</div>
                <div class='rot-text'>Delete</div>
            </div>

            <div class='white-box-container'>
                <div class='resource-row'>
                    <div class='res-label'>Security data sheet:</div>
                    <div class='res-value'><a href="/pdf/${data.objectNumber.replace('#', '-')}.pdf" target="_blank">${data.objectNumber} ${data.objectName}.pdf</a></div>
                    <div class='action-cell'><a href='/api/editvirus/${data.id}' class='action-link'>E</a></div>
                    <div class='action-cell'><a href='#' class='action-link'>D</a></div>
                </div>
                
                ${attachmentsHTML}

                <div class='resource-row' style="background-color: #f1f5fa;">
                    <div class='res-label'>Add new attachment:</div>
                    <div class='res-value'></div>
                    <div class='action-cell' style="width: 100px; text-align: right; padding-right: 10px;">
                        <a href='/api/fileuploadvirus/${safeVirusId}' class='action-link' style="font-size: 14px;">➕ Upload</a>
                    </div>
                </div>
            </div>
        </div>`;

        response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
        response.write(htmlHead);
        writeMenu(request, response);
        response.write(htmlHeader); 
        response.write(htmlMenu);   
        response.write(htmlInfoStart); 
        response.write(htmlOutput);
        
        response.write(readHTML('./masterframe/researchentries_css.html'));
        response.write(readHTML('./masterframe/researchentries_js.html'));
        response.write(readHTML('./masterframe/researchentries.html'));
        
        response.write(htmlInfoStop);
        response.write(htmlFooter);
        response.write(htmlBottom);
        response.end();
    } catch (error) {
        response.status(500).send("Error: " + error.message);
    }
});

router.post('/:id/delete-file', express.urlencoded({ extended: true }), (request, response) => {
    const id = request.params.id;
    const fileName = request.body.fileName;

    if (request.session.loggedin) {
        const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, '');
        const filePath = path.join(__dirname, '..', 'data', safeId, 'attachments', fileName);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log("Tricell: File deleted -> " + fileName);
        }
        response.redirect(`/api/virusdatabase/${id}`);
    } else {
        response.status(401).send("Unauthorized");
    }
});

module.exports = router;