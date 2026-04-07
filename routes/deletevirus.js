const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const pug = require('pug');
const readHTML = require('../readHTML.js');

router.use(express.static('./public'));
const pug_loggedinmenu = pug.compileFile('./masterframe/loggedinmenu.html');

// --------------------- Läs in Masterframen --------------------------------
var htmlHead = readHTML('./masterframe/head.html');
var htmlHeader = readHTML('./masterframe/header.html');
var htmlMenu = readHTML('./masterframe/menu.html');    
var htmlInfoStart = readHTML('./masterframe/infoStart.html');
var htmlInfoStop = readHTML('./masterframe/infoStop.html');
var htmlFooter = readHTML('./masterframe/footer.html');
var htmlBottom = readHTML('./masterframe/bottom.html');
var htmlLoggedinMenuCSS = readHTML('./masterframe/loggedinmenu_css.html');
var htmlLoggedinMenuJS = readHTML('./masterframe/loggedinmenu_js.html');

// --- NY FUNKTION: RADERA EN SPECIFIK FIL (Bilaga) ---
// Denna fångar upp "POST /api/virusdatabase/1/delete-file"
router.post('/:id/delete-file', function(request, response) {
    const id = request.params.id;
    const fileName = request.body.filename; // Vi förväntar oss filnamnet från formuläret

    if (request.session.loggedin) {
        const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, '');
        const filePath = path.join(__dirname, '..', 'data', safeId, 'attachments', fileName);

        console.log("Tricell Security: Deleting file:", filePath);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        // Skicka tillbaka till virusets sida
        response.redirect(`/api/virusdatabase/${id}`);
    } else {
        response.status(401).send("Unauthorized");
    }
});


// --- BEFINTLIG FUNKTION: RADERA HELA VIRUSET ---
router.get('/:id', function(request, response)
{
    const id = parseInt(request.params.id);
    const ADODB = require('node-adodb');
    const connection = ADODB.open('Provider=Microsoft.Jet.OLEDB.4.0;Data Source=./data/mdb/researchdata.mdb;');

    async function sqlQuery()
    {
        response.setHeader('Content-type','text/html; charset=utf-8');
        response.write(htmlHead);
        
        if(request.session.loggedin)
        {
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

        if(request.session.loggedin)
        {
            // Radera från Access-databasen
            await connection.execute("DELETE FROM ResearchObjects WHERE id="+id+"");
            
            // Ta bort mappen i public/virusphoto
            var imagePath = `./public/virusphoto/${id}`;
            if(fs.existsSync(imagePath)) {
                fs.rmdirSync(imagePath, { recursive: true });
            }

            // Ta även bort mappen i data/id/attachments
            var dataPath = `./data/${id}`;
            if(fs.existsSync(dataPath)) {
                fs.rmdirSync(dataPath, { recursive: true });
            }

            response.write("<h3><i class='fa-solid fa-trash-can'></i> Research Object #" + id + " deleted</h3>");
            response.write("<p><a href='/api/virusdatabase' style='color:#336699;text-decoration:none;'>&laquo; Back to Research Database</a></p>");
        }
        else
        {
            response.write("Not logged in or access denied");
        }

        response.write(htmlInfoStop);
        response.write(htmlFooter);
        response.write(htmlBottom);
        response.end();
    }
    sqlQuery();
});

module.exports = router;