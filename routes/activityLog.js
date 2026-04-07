const express = require('express');
const router = express.Router();

router.use(express.static('./public'));
const path = require('path');

const pug = require('pug');
const { response } = require('express');

const pug_loggedinmenu = pug.compileFile('./masterframe/loggedinmenu.html');

const canEdit = (request) => {
    if (!request.session.loggedin) return false;
    
    const level = request.session.securityAccessLevel || request.session.securityaccesslevel;
    return ['A', 'B'].includes(level);
};

// --------------------- Läs in Masterframen --------------------------------
const readHTML = require('../readHTML.js');
const fs = require('fs');
const { json } = require('express');

var htmlHead = readHTML('./masterframe/head.html');
var htmlHeader = readHTML('./masterframe/header.html');
var htmlMenu = readHTML('./masterframe/menu.html');    
var htmlInfoStart = readHTML('./masterframe/infoStart.html');
var htmlInfoStop = readHTML('./masterframe/infoStop.html');
var htmlBottom = readHTML('./masterframe/bottom.html');

// ---------------------- -------------------------------
router.get('/', (request, response) =>
{    
    if (canEdit(request))
    {
        const ADODB = require('node-adodb');
        const connection = ADODB.open('Provider=Microsoft.Jet.OLEDB.4.0;Data Source=./data/mdb/activity_log.mdb;');

        async function sqlQuery()
        {
            let currentSortAmount = request.cookies.sortAmount || 20;
            let currentSortType = request.cookies.sortType || "ID";

            response.writeHead(200, {'Content-Type': 'text/html'});
            response.write(htmlHead);
            if(request.session.loggedin)
            {
                htmlLoggedinMenuCSS = readHTML('./masterframe/loggedinmenu_css.html');
                response.write(htmlLoggedinMenuCSS);
                htmlLoggedinMenuJS = readHTML('./masterframe/loggedinmenu_js.html');
                response.write(htmlLoggedinMenuJS);
                response.write(pug_loggedinmenu({
                    employeecode: request.cookies.employeecode,
                    name: request.cookies.name,
                    logintimes: request.cookies.logintimes,
                    lastlogin: request.cookies.lastlogin,
                    securityaccesslevel: request.session.securityAccessLevel || request.session.securityaccesslevel // FIX!
                }));
            }
            response.write(htmlHeader);
            response.write(htmlMenu);
            response.write(htmlInfoStart);

            let htmlOutput =""+
            "<link rel=\"stylesheet\" href=\"css/personnel_registry.css\" />\n"+
            "<script src=\"./scripts/activitylogsorting.js\"></script>\n";

            htmlOutput +="<table border=\"0\">";
            htmlOutput +="<tr><td width=\"100px\" align=\"left\">";
            htmlOutput +="<h2>Activity Log</h2></td>\n";
            
            // Sort options
            htmlOutput +="<td width=\"80\" align=\"center\">";
            htmlOutput +="<h2>Sort By:</h2></td>\n";

            htmlOutput +="<td width=\"52\" align=\"left\" onclick=\"sorting(20, '"+ currentSortType +"')\">";
            htmlOutput +="<a style=\"text-decoration: none;color: black; cursor: pointer;\">";
            htmlOutput +="<h2><b>20</b></h2></a></td>\n";

            htmlOutput +="<td width=\"52\" align=\"left\" onclick=\"sorting(50, '"+ currentSortType +"')\">";
            htmlOutput +="<a style=\"text-decoration: none;color: black; cursor: pointer;\">";
            htmlOutput +="<h2><b>50</b></h2></a></td>\n";

            htmlOutput +="<td width=\"52\" align=\"left\" onclick=\"sorting(100, '"+ currentSortType +"')\">";
            htmlOutput +="<a style=\"text-decoration: none;color: black; cursor: pointer;\">";
            htmlOutput +="<h2><b>100</b></h2> </a> </td>\n";

            htmlOutput +="<td width=\"72\" align=\"left\" onclick=\"sorting(150, '"+ currentSortType +"')\">";
            htmlOutput +="<a style=\"text-decoration: none;color: black; cursor: pointer;\">";
            htmlOutput +="<h2><b>150</b></h2> </a> </td>\n";
            
            // Secondary sort options
            htmlOutput +="<td width=\"88\" align=\"center\">";
            htmlOutput +="<a style=\"text-decoration: none;color: black;\">";
            htmlOutput +="<h2>Sort By:</h2> </a> </td>\n";

            htmlOutput +="<td width=\"64\" align=\"left\" onclick=\"sorting("+ currentSortAmount +", 'Activity')\">";
            htmlOutput +="<a style=\"text-decoration: none;color: black; cursor: pointer;\">";
            htmlOutput +="<h2><b>Activity</b></h2> </a> </td>\n";

            htmlOutput +="<td width=\"52\" align=\"center\" onclick=\"sorting("+ currentSortAmount +", 'EmployeeCode')\">";
            htmlOutput +="<a style=\"text-decoration: none;color: black; cursor: pointer;\">";
            htmlOutput +="<h2><b>User</b></h2> </a> </td>\n";

            htmlOutput +="<td width=\"52\" align=\"center\" onclick=\"sorting("+ currentSortAmount +", 'ID')\">";
            htmlOutput +="<a style=\"text-decoration: none;color: black; cursor: pointer;\">";
            htmlOutput +="<h2><b>Date</b></h2> </a> </td>\n";
            htmlOutput +="</tr></table>\n"; 

            htmlOutput +="<div id=\"table-resp\">"+
            "<div id=\"table-header\">\n"+
            "<div class=\"table-header-cell-light\">Activity</div>\n"+
            "<div class=\"table-header-cell-dark\">User</div>\n"+
            "<div class=\"table-header-cell-light\">Name</div>\n"+
            "<div class=\"table-header-cell-light\">Date</div>\n"+
            "<div class=\"table-header-cell-light\">Time</div>\n";
            
            if(canEdit(request))
            {
                htmlOutput += "<div class=\"table-header-cell-light\">Delete</div>\n";
            }
            htmlOutput +="</div>\n\n"+
            "<div id=\"table-body\">\n";

            let result;

            // Query 1
            if (currentSortType == "ID")
            {
                result = await connection.query("SELECT TOP "+ currentSortAmount +" ID, Activity, EmployeeCode, Name, Date, Time FROM Log ORDER BY "+ currentSortType +" desc");
            }
            else
            {
                result = await connection.query("SELECT TOP "+ currentSortAmount +" ID, Activity, EmployeeCode, Name, Date, Time FROM Log ORDER BY "+ currentSortType +" desc, ID desc");
            }

            var count = result.length;

            let i;
            for(i=0; i<count; i++)
            {   
                let str_id = result[i]['ID'];  
                let str_activity = result[i]['Activity'];      
                let str_employeeCode = result[i]['EmployeeCode'];
                let str_name = result[i]['Name'];
                let str_date = result[i]['Date'];
                let str_time = result[i]['Time'];
                
                htmlOutput += "<div class=\"resp-table-row\">\n";
                htmlOutput += "<div class=\"table-body-cell\">" + str_activity + "</div>\n";
                htmlOutput += "<div class=\"table-body-cell-bigger\">" + str_employeeCode + "</div>\n";
                htmlOutput += "<div class=\"table-body-cell\"> " + str_name + "</div>\n";
                htmlOutput += "<div class=\"table-body-cell\"> " + str_date + "</div>\n";
                htmlOutput += "<div class=\"table-body-cell\"> " + str_time + "</div>\n";
                if(canEdit(request))
                {
                    htmlOutput += "<div class=\"table-body-cell\"><a href=\"/api/activitylog/" + str_id + "\" style=\"color:red;text-decoration:none;\">D</a></div>\n";
                }
                htmlOutput += "</div>\n";
            }  

            htmlOutput += "</div></div>\n\n";
            response.write(htmlOutput); 

            response.write(htmlInfoStop);
            response.write(htmlBottom);
            response.end();
        }
        sqlQuery();
    }
    else
    {
        response.writeHead(200, {'Content-Type': 'text/html'});
        response.write(htmlHead);
        if(request.session.loggedin)
        {
            htmlLoggedinMenuCSS = readHTML('./masterframe/loggedinmenu_css.html');
            response.write(htmlLoggedinMenuCSS);
            htmlLoggedinMenuJS = readHTML('./masterframe/loggedinmenu_js.html');
            response.write(htmlLoggedinMenuJS);
            response.write(pug_loggedinmenu({
                employeecode: request.cookies.employeecode,
                name: request.cookies.name,
                logintimes: request.cookies.logintimes,
                lastlogin: request.cookies.lastlogin,
                securityaccesslevel: request.session.securityAccessLevel || request.session.securityaccesslevel // FIX!
            }));
        }
        response.write(htmlHeader);
        response.write(htmlMenu);
        response.write(htmlInfoStart);

        let htmlOutput = "<h2>You are not authorised to access this.</h2>";

        response.write(htmlOutput);

        response.write(htmlInfoStop);
        response.write(htmlBottom);
        response.end();
    }
});

// Delete specific activity log
router.get('/:id', (request, response) =>
{    
    const ADODB = require('node-adodb');
    const connection = ADODB.open('Provider=Microsoft.Jet.OLEDB.4.0;Data Source=./data/mdb/activity_log.mdb;');
    
    const deleteID = request.params.id;

    async function deleteSQLquery()
    {
        response.setHeader('Content-type','text/html');
        response.write(htmlHead);

        if(request.session.loggedin)
        {
            htmlLoggedinMenuCSS = readHTML('./masterframe/loggedinmenu_css.html');
            response.write(htmlLoggedinMenuCSS);
            htmlLoggedinMenuJS = readHTML('./masterframe/loggedinmenu_js.html');
            response.write(htmlLoggedinMenuJS);
            response.write(pug_loggedinmenu({
                employeecode: request.cookies.employeecode,
                name: request.cookies.name,
                logintimes: request.cookies.logintimes,
                lastlogin: request.cookies.lastlogin,
                securityaccesslevel: request.session.securityAccessLevel || request.session.securityaccesslevel // FIX!
            }));
        }

        response.write(htmlHeader);
        response.write(htmlMenu);
        response.write(htmlInfoStart);

        if(canEdit(request))
        {
            const result = await connection.query("SELECT ID FROM Log WHERE ID=" + deleteID);
            
            if(result.length > 0)
            {
                const deleteResult = await connection.execute("DELETE FROM Log WHERE ID=" + deleteID);
                response.write("Activity log deleted.<br />");
                response.write("<a href=\"/api/activitylog\" style=\"color:#336699;\">Back to Activity Log</a>");
            }
            else
            {
                response.write("Object not found.");
            }
        }
        else
        {
            response.write("You are not authorised to do this.");
        }
    
        response.write(htmlInfoStop);
        response.write(htmlBottom);
        response.end();
    }
    deleteSQLquery();
});

module.exports = router;