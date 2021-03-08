const express = require('express');
const app = express();
const fetch = require('node-fetch');
const session = require('express-session');
const {v4: uuidv4} = require('uuid');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const fileUpload = require('express-fileupload');
const cors = require('cors');


// creds required for ezeep api
const credentials = {
    client: { 
        id: "HxUvmMbJkbStzKN6s3SCGWh4RrzylCvdCiNrztGP",
        secret:"bZFWwsClPYkStAI2zGvxPIcD5EqCVm2XsqVDcaKaIvCf5jXYDFTmqXNIlL6GOsbSgvkwgHWzFUkScdLaXFnr1w1faiGUS00Rr4RbLssDvgkBOl8zyoWsFblvcDiJTYUY"
    },
    auth: {
        tokenPath: '/oauth/access_token',
        tokenHost: "https://account.ezeep.com",
    },
};



// oauth2 library to consume
const { AuthorizationCode, ClientCredentials } = require('simple-oauth2');
const oauth2 = new ClientCredentials(credentials);
// crete the client for authrozation code that we will receive from ezeep oauth
const client = new AuthorizationCode(credentials)
let accessToken; 
app.use(cookieParser());
//creating a session so tha>?t app can use that
initilaizeSession = () => {
    const token_session = session({
        secret:'anyrandomstring',
        resave: false,
        saveUninitialized: true,
        cookie:{
            maxAge: 24 * 60 * 60 * 1000,
        }
    })
    return token_session;
}
app.use(fileUpload());
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());

app.use(express.urlencoded({extended: true}));
app.use(initilaizeSession());




let tokenParams = {
    code: null,
    redirect_uri: 'https://test-printer-api.herokuapp.com/callback',
    grant_type: 'authorization_code',
}

// callback function to receive the code
app.get('/callback', async (req, res, next) => {
    console.log("Callback in process")
    const authCode = req.query.code;
    console.log(authCode)
    tokenParams['code'] = authCode;
    
    try {
        accessToken = await client.getToken(tokenParams, {json: true});
        console.log('The resulting token: ', accessToken.token);
        req.session.accessToken = JSON.stringify(accessToken);
        req.session.save();
        return res.status(200).json(accessToken.token);
      } catch (error) {
          console.log('Access Token Error', error.message);
          return res.status(500).json('Authentication failed');
      }

});

app.get('/authorize', function (req, res) {
    console.log("authorization in process")
    const authorizationUri = client.authorizeURL({
        redirect_uri: 'https://test-printer-api.herokuapp.com/callback',
    
    })
    res.redirect(authorizationUri);
})

//Get the list of printers
app.get('/printers', async function(req, res){
    console.log("Getting the list of printers");
    let response;
    token = req.query.token;
    let configRequest = {
        method: 'GET',
        headers: {
            Accept:'*/*',
            Accept: 'Encoding: gzip, deflate',
            Authorization: 'Bearer ' + token,
        }
    }

    const url = 'https://printapi.ezeep.com/sfapi/GetPrinter';
    try {
        response = await fetch (url, configRequest);
        if (response.status === 401){
            return res.status(401).json("The API is unauthorized, Please make sure you authorize it again");
        }
        const respJson = await response.json()      
        return res.status(200).json(respJson);
    } catch (error) { 
        return res.status(500).json('Failed getting pinters', error);
    }

})



app.get('/refreshtoken', async function(req,res){
    let accessTokenString = req.session.accessToken;
    console.log("checking the token", accessTokenString);
    if (!req.session.accessToken){
        accessTokenString = req.query.string;
    }
    let tokenResponse; 
    refreshParams = {
        scope: 'printing',
    }
    try{
         let newToken = client.createToken(JSON.parse(accessTokenString))
         accessToken = newToken
         console.log("newToken", newToken);
         if (newToken.expired()){
            console.log("refreshing the token");
            accessToken = await newToken.refresh(refreshParams); 
            res.status(200).json(accessToken.token)
         }
         res.status(200).json(accessToken)
    } catch (error){
        console.error('Error refreshing access Token', error);
        res.status(500).json("Error occured in refreshing the token")
    }
    
});

app.post('/printerinfo', async function(req,res){
    const {printer_name, printer_id, token} = req.body
    console.log(printer_name, printer_id, token);
    let configRequest = {
        method: 'GET',
        headers: {
            Accept:'*/*',
            Accept: 'Encoding: gzip, deflate',
            Authorization: 'Bearer ' + token,
        }
    }
    const url = "https://printapi.ezeep.com/sfapi/GetPrinterProperties/?id=" + printer_id
    console.log("The url looks like" + url);
    try{
         const response = await fetch(url, configRequest)
         if (response.status === 401){
            return res.status(401).json("The API is unauthorized, Please make sure you authorize it again");
        }
        const respJson = await response.json()      
        return res.status(200).json(respJson);
    } catch (error){
        console.error('Error getting printer info', error);
        res.status(500).json("Error occured getting the printer info.")
    }
    
});


app.get('/prepareupload', async function(req,res){
    const token  = req.query.token
    let configRequest = {
        method: 'GET',
        headers: {
            Accept:'*/*',
            Accept: 'Encoding: gzip, deflate',
            Authorization: 'Bearer ' + token,
        }
    }
    const url = "https://printapi.ezeep.com/sfapi/PrepareUpload";
    console.log("The url looks like" + url);
    try{
         const response = await fetch(url, configRequest)
         if (response.status === 401){
            return res.status(401).json("The API is unauthorized, Please make sure you authorize it again");
        }
        const respJson = await response.json()      
        return res.status(200).json(respJson);
    } catch (error){
        console.error('Error preparing the upload', error);
        res.status(500).json("Error preparing the upload");
    }
    
});

app.post('/uploadfile', async function(req, res){
    const {sasURI} = req.body;

    console.log(sasURI);
    let fileToPrint = req.files.doc;
    console.log(fileToPrint);
    const path = __dirname + '/uploads/'+ fileToPrint.name;
    console.log(path)
    fileToPrint.mv(path);
    const configParams = {
        method: 'PUT',
        headers: {
            Accept:'*/*',
            Accept: 'Encoding: gzip, deflate',
            "Content-Type":'multipart/form-data',
            'x-ms-blob-type': 'BlockBlob'
        },
        file:path,
    }
    const url = sasURI;
    console.log(url)
    try{
        const response = await fetch(url, configParams)
        if (response.status === 401){
           return res.status(401).json("The API is unauthorized, Please make sure you authorize it again");
       }
       const respJson = await response.json()      
       return res.status(200).json(respJson);
   } catch (error){
       console.error('Error uploading the file', error);
       res.status(500).json("Error uploading the file'");
   }

    // res.send({
    //     status:true,
    //     message: 'File is uploaded',
    //     data: {
    //         name: printFile.name,
    //         mimetype: printFile.mimetype,
    //         size: printFile.size
    //     }
    // })
})

app.use((err, req, res, next) => {
    res.locals.message = err.message;
    res.status(err.status || 500);
    res.render('error');
});

app.listen(process.env.PORT || 8080, function () {
   console.log("The test api app listening on:", process.env.PORT || 8080);
})