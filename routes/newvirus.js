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

var htmlLoggedinMenuCSS = readHTML('./masterframe/loggedinmenu_css.html');
var htmlLoggedinMenuJS = readHTML('./masterframe/loggedinmenu_js.html');
// var htmlLoggedinMenu = readHTML('./masterframe/loggedinmenu.html');

const allowedLevels = ['A', 'B'];

// ---------------------- Lägg till nytt virus ------------------------------------------------
router.post('/', function(request, response)
{
    // Ta emot variablerna från formuläret
    var form = new formidable.IncomingForm();
    form.parse(request, function (err, fields, files) 
    {
        var objectNumber = fields.fobjectNumber;
        var objectName = fields.fobjectName;
        var objectText = fields.fobjectText;
        
        // Länkar från formuläret
        var securityDataSheet = fields.fsecurityDataSheet; // Finns ej i DB ännu, men vi läser in den
        var presentationVideoLink = fields.fsecurityPresentationVideo;
        var securityVideoLink = fields.fsecurityHandlingVideo;

        // Autogenererade variabler som användaren inte skriver in
        var objectCreator = request.cookies.employeecode;
        var objectStatus = "open";
        var Entries = "0";
   
        // Skapa inskrivningsdatum och tid exakt som i din tidigare kod
        let ts = Date.now();
        let date_ob = new Date(ts);
        let date = date_ob.getDate();
        let month = date_ob.getMonth() + 1;
        let year = date_ob.getFullYear();
        let hours = date_ob.getHours();
        let minutes = date_ob.getMinutes();

        // Lägg till en nolla framför om klockan är t.ex. 9:5 (blir 09:05)
        if(hours < 10) { hours = "0" + hours; }
        if(minutes < 10) { minutes = "0" + minutes; }
        if(date < 10) { date = "0" + date; }
        if(month < 10) { month = "0" + month; }

        let objectCreatedDate = date+"."+month+"."+year;
        let objectCreatedTime = hours+":"+minutes;
        let lastEntry = objectCreatedDate; // Sätts till samma som skapandedatum från början

        // Öppna databasen
        const ADODB = require('node-adodb');
        const connection = ADODB.open('Provider=Microsoft.Jet.OLEDB.4.0;Data Source=./data/mdb/researchdata.mdb;');

        async function sqlQuery()
        {
            response.setHeader('Content-type','text/html');
            response.write(htmlHead);
            
            // Kolla så att man är inloggad OCH har rätt nivå för att ladda menyn
            if(request.session.loggedin && allowedLevels.includes(request.session.securityAccessLevel))
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

            // Kolla säkerheten innan vi gör en INSERT till databasen
            if(request.session.loggedin && allowedLevels.includes(request.session.securityAccessLevel))
            {
                // Skicka SQL-query till databasen - Exakt i din stil med sträng-ihopslagning
                const result = await connection.execute("INSERT INTO ResearchObjects (objectNumber, objectName, objectCreator, objectCreatedDate, objectCreatedTime, objectText, objectStatus, presentationVideoLink, securityVideoLink, Entries, lastEntry) VALUES ('"+objectNumber+"','"+objectName+"','"+objectCreator+"','"+objectCreatedDate+"','"+objectCreatedTime+"','"+objectText+"','"+objectStatus+"','"+presentationVideoLink+"','"+securityVideoLink+"','"+Entries+"','"+lastEntry+"')");

                // Filuppladdning saknas i detta formulär, så vi skippar if(files.ffile...) 

                // Ge respons till användaren
                response.write("Research Object created<br/><p /><a href=\"http://localhost:3000/api/newvirus\" style=\"color:#336699;text-decoration:none;\">Add another object</a>");
            }
            else
            {
                response.write("<h2>Access Denied</h2><p>You do not have the required security clearance.</p>");
            }

            response.write(htmlInfoStop);
            response.write(htmlFooter);
            response.write(htmlBottom);
            response.end();
        }
        sqlQuery();
    });
});

// ---------------------- Formulär för att lägga till nytt virus ------------------------------
router.get('/', (request, response) =>
{  
    response.setHeader('Content-type','text/html');
    response.write(htmlHead);
    
    if(request.session.loggedin && allowedLevels.includes(request.session.securityAccessLevel))
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

    // Läs in formuläret om användaren har behörighet
    if(request.session.loggedin && allowedLevels.includes(request.session.securityAccessLevel))
    {
        htmlNewVirusCSS = readHTML('./masterframe/newvirus_css.html');
        response.write(htmlNewVirusCSS);
        htmlNewVirusJS = readHTML('./masterframe/newvirus_js.html');   
        response.write(htmlNewVirusJS);
        htmlNewVirus = readHTML('./masterframe/newvirus.html');        
        response.write(htmlNewVirus);
    }
    else
    {
        response.write("<h2>Access Denied</h2><p>You do not have the required security clearance.</p>");
    }
    
    response.write(htmlInfoStop);
    response.write(htmlFooter);
    response.write(htmlBottom);
    response.end();
});

module.exports = router;