const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
var formidable = require('formidable');

router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: false }));

router.use(express.static('./public'));
const path = require('path');

const pug = require('pug');
const { response } = require('express');
const pug_loggedinmenu = pug.compileFile('./masterframe/loggedinmenu.html');
// VIKTIGT: Se till att filen nedan finns sparad innan du startar servern!
const pug_editvirus = pug.compileFile('./masterframe/editvirus.html'); 
const { getVirusImagesHTML } = require('./virusimages.js');

// --------------------- Läs in Masterframen --------------------------------
const readHTML = require('../readHTML.js');
const fs = require('fs');

var htmlHead = readHTML('./masterframe/head.html');
var htmlHeader = readHTML('./masterframe/header.html');
var htmlMenu = readHTML('./masterframe/menu.html');
var htmlInfoStart = readHTML('./masterframe/infoStart.html');
var htmlInfoStop = readHTML('./masterframe/infoStop.html');
var htmlFooter = readHTML('./masterframe/footer.html');
var htmlBottom = readHTML('./masterframe/bottom.html');
var htmlVirusimagesCSS = readHTML('./masterframe/virusimages_css.html');

var htmlLoggedinMenuCSS = readHTML('./masterframe/loggedinmenu_css.html');
var htmlLoggedinMenuJS = readHTML('./masterframe/loggedinmenu_js.html');
// var htmlLoggedinMenu = readHTML('./masterframe/loggedinmenu.html');


// ---------------------- Editera virus ------------------------------------------------
router.post('/:id', function(request, response)
{
    var id = request.params.id;

     // Ta emot variablerna från formuläret
    if(request.session.loggedin)
    {
        var form = new formidable.IncomingForm();
        form.parse(request, function (err, fields, files) 
        {
            var number = fields.fnumber;
            var name = fields.fname;
            var text = fields.ftext;
            var presentationvideo = fields.fpresentationvideo;
            var handlingvideo = fields.fhandlingvideo;

            // Öppna databasen
            const ADODB = require('node-adodb');
            const connection = ADODB.open('Provider=Microsoft.Jet.OLEDB.4.0;Data Source=./data/mdb/researchdata.mdb;');

            async function sqlQuery()
            {
                response.setHeader('Content-type','text/html');
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
                    }));
                }
                response.write(htmlHeader);
                response.write(htmlMenu);
                response.write(htmlInfoStart);

                // Skriv in i databasen
                const result = await connection.execute("UPDATE ResearchObjects SET objectNumber='"+number+"',objectName='"+name+"',objectText='"+text+"',presentationVideoLink='"+presentationvideo+"',securityVideoLink='"+handlingvideo+"' WHERE id="+id+"");

                // Ge respons till användaren
                response.write("Research Object edited<br/><p /><a href=\"http://localhost:3000/api/researchdatabase\" style=\"color:#336699;text-decoration:none;\">Back to Research Database</a>");

                response.write(htmlInfoStop);
                response.write(htmlFooter);
                response.write(htmlBottom);
                response.end();
            }
            sqlQuery();
        });
    }
    else
    {
        response.setHeader('Content-type','text/html');
        response.write(htmlHead);
        response.write(htmlHeader);
        response.write(htmlMenu);
        response.write(htmlInfoStart);

        response.write("Not logged in");

        response.write(htmlInfoStop);
        response.write(htmlFooter);
        response.write(htmlBottom);
        response.end();
    }
});


// ---------------------- Formulär för att editera virus ------------------------------
router.get('/:id', (request, response) =>
{  
    var id = request.params.id;

    // Öppna databasen
    const ADODB = require('node-adodb');
    const connection = ADODB.open('Provider=Microsoft.Jet.OLEDB.4.0;Data Source=./data/mdb/researchdata.mdb;');
   
    async function sqlQuery()
    {
        // Läs nuvarande värden ur databasen
        const result = await connection.query("SELECT objectNumber, objectName, objectText, presentationVideoLink, securityVideoLink FROM ResearchObjects WHERE id="+id+"");
    
        let str_number = "" + result[0]['objectNumber'];
        let str_name = "" + result[0]['objectName'];
        let str_text = "" + result[0]['objectText'];
        let str_presentationvideo = "" + result[0]['presentationVideoLink'];
        let str_handlingvideo = "" + result[0]['securityVideoLink'];

        response.setHeader('Content-type','text/html');
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
            }));
        }
        response.write(htmlHeader);
        response.write(htmlMenu);
        response.write(htmlInfoStart);

        if(request.session.loggedin)
        {
            // Laddar samma CSS/JS som du hade i editemployee för att hålla utseendet lika
            htmlNewEmployeeCSS = readHTML('./masterframe/newemployee_css.html');
            response.write(htmlNewEmployeeCSS);
            htmlNewEmployeeJS = readHTML('./masterframe/newemployee_js.html');
            response.write(htmlNewEmployeeJS);
            
            response.write(htmlVirusimagesCSS);
            response.write(pug_editvirus({
                id: id,
                number: str_number,
                name: str_name,
                text: str_text,
                presentationvideo: str_presentationvideo,
                handlingvideo: str_handlingvideo
            }));
            response.write(getVirusImagesHTML(id));
        }
        else
        {
            response.write("Not logged in");
        }
        
        response.write(htmlInfoStop);
        response.write(htmlFooter);
        response.write(htmlBottom);
        response.end();
    }
    sqlQuery();
});

module.exports = router;