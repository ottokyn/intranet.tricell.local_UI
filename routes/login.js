const express = require('express');
const router = express.Router();
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const pug = require('pug');

router.use(cookieParser());
router.use(express.static('./public'));

const pug_loggedinmenu = pug.compileFile('./masterframe/loggedinmenu.html');

// --------------------- Läs in Masterframen ----------------------------------
const readHTML = require('../readHTML.js');

var htmlHead = readHTML('./masterframe/head.html');
var htmlHeader = readHTML('./masterframe/header.html');
var htmlMenu = readHTML('./masterframe/menu.html');    
var htmlInfoStart = readHTML('./masterframe/infoStart.html');
var htmlInfoStop = readHTML('./masterframe/infoStop.html');
var htmlFooter = readHTML('./masterframe/footer.html');
var htmlBottom = readHTML('./masterframe/bottom.html');

var htmlLoggedinMenuCSS = readHTML('./masterframe/loggedinmenu_css.html');
var htmlLoggedinMenuJS = readHTML('./masterframe/loggedinmenu_js.html');

// --------------------- Router: Kontrollera inloggning -----------------------
router.get('/', function(request, response) {
    const employeeid = request.query.femployeecode;
    const passwd = request.query.fpassword;
    
    const ADODB = require('node-adodb');
    const connection = ADODB.open('Provider=Microsoft.Jet.OLEDB.4.0;Data Source=./data/mdb/personnelregistry.mdb;');
    
    async function sqlQuery1() {
        const result = await connection.query("SELECT passwd, logintimes, lastlogin, lockout FROM users WHERE employeeCode='" + employeeid + "'");        
        
        if (result == "") {
            response.redirect('/api/login/unsuccess'); 
        } else {
            let str_passwd = result[0]['passwd'];
            let str_logintimes = result[0]['logintimes'] || "0";    
            let str_lockout = result[0]['lockout'];    

            const result2 = await connection.query("SELECT * FROM employee WHERE employeeCode='" + employeeid + "'");
            let str_name = result2[0]['name'];
            let str_securityaccesslevel = result2[0]['securityAccessLevel'];    
                               
            if (str_lockout == null) {
                if (str_passwd == passwd) {
                    // Beräkna tid och uppdatera variabler
                    let int_logintimes = parseInt(str_logintimes) + 1;
                    let ts = Date.now();
                    let date_ob = new Date(ts);
                    let str_lastlogin = date_ob.getDate() + "." + (date_ob.getMonth() + 1) + "." + date_ob.getFullYear();

                    // Sätt Cookies
                    response.cookie("employeecode", employeeid);
                    response.cookie("name", str_name);
                    response.cookie("lastlogin", str_lastlogin);
                    response.cookie("logintimes", int_logintimes);
                    response.cookie("sortAmount", 20);
                    response.cookie("sortType", "ID");

                    // Starta Session
                    request.session.loggedin = true;
                    request.session.username = employeeid;
                    request.session.securityAccessLevel = str_securityaccesslevel;

                    // Uppdatera users-tabellen
                    await connection.execute("UPDATE users SET logintimes='" + int_logintimes + "', lastlogin='" + str_lastlogin + "' WHERE employeeCode='" + employeeid + "'");

                    // Tvinga session-sparning innan redirect (viktigt för stabilitet)
                    request.session.save(() => {
                        response.redirect('/api/login/success');
                    });
                } else {
                    response.redirect('/api/login/unsuccess');
                }
            } else {
                response.redirect('/api/login/unsuccess');
            }    
        }
    }   
    sqlQuery1().catch(err => console.log("Login Error: ", err));
});

// --------------------- Router: Success (Här loggas aktiviteten) ------------
router.get('/success', function(request, response) {
    const ADODB = require('node-adodb');
    // Vi öppnar activity_log mdb här
    const logConn = ADODB.open('Provider=Microsoft.Jet.OLEDB.4.0;Data Source=./data/mdb/activity_log.mdb;');

    async function handleSuccess() {
        response.setHeader('Content-type', 'text/html; charset=utf-8');
        response.write(htmlHead);
        response.write(htmlHeader);
        response.write(htmlMenu);
        response.write(htmlInfoStart);

        if (request.session.loggedin) {
            response.write("<h3>Login successful</h3>");
            response.write(htmlLoggedinMenuCSS);
            response.write(htmlLoggedinMenuJS);
            
            response.write(pug_loggedinmenu({
                employeecode: request.cookies.employeecode,
                name: request.cookies.name,
                logintimes: request.cookies.logintimes,
                lastlogin: request.cookies.lastlogin,
                securityaccesslevel: request.session.securityAccessLevel
            }));

            // --- ACTIVITY LOG LOGIK ---
            try {
                // 1. Rensa gamla loggar (behåll de 150 senaste)
                await logConn.execute("DELETE FROM Log WHERE ID NOT IN (SELECT TOP 150 ID FROM Log ORDER BY ID DESC)");

                // 2. Skapa tidsstämplar för loggen
                let ts = Date.now();
                let date_ob = new Date(ts);
                let loginDate = date_ob.getDate() + "." + (date_ob.getMonth() + 1) + "." + date_ob.getFullYear();
                let timeOfLogin = date_ob.getHours() + ":" + (date_ob.getMinutes() < 10 ? '0' : '') + date_ob.getMinutes();

                // 3. Skriv till activity_log.mdb
                await logConn.execute("INSERT INTO Log (Activity, EmployeeCode, [Name], [Date], [Time]) " +
                    "VALUES ('Login', '" + request.cookies.employeecode + "', '" + request.cookies.name + "', '" + loginDate + "', '" + timeOfLogin + "')");
                
                console.log("Activity Log updated for: " + request.cookies.name);
            } catch (e) {
                console.log("Log Database Error: ", e);
            }
        } else {
            response.write("Access Denied: Not logged in");
        }

        response.write(htmlInfoStop);
        response.write(htmlFooter);
        response.write(htmlBottom);
        response.end();
    }
    handleSuccess();
});

// --------------------- Router: Unsuccess ------------------------------------
router.get('/unsuccess', function(request, response) {
    response.setHeader('Content-type', 'text/html; charset=utf-8');
    response.write(htmlHead);
    response.write(htmlHeader);
    response.write(htmlMenu);
    response.write(htmlInfoStart);

    response.write("<h3 style='color:red;'>Login unsuccessful</h3>");
    response.write("<p>Please check your credentials or contact system administrator.</p>");

    response.write(htmlInfoStop);
    response.write(htmlFooter);
    response.write(htmlBottom);
    response.end();   
});

module.exports = router;