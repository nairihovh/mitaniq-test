import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import https from 'https';
import fs from 'fs';
import jwt from "jsonwebtoken"
import dotenv from "dotenv"
import multer from 'multer';
import cookieParser from 'cookie-parser';
import { fileTypeFromBuffer } from 'file-type';
import metax, { getInterestsList, saveObject, getUser, getUsers, getUserByUUID, createPublication, sha256Hash, registerUser, loginUser, connectToMetax} from './metaxHelpers.js';  // Import the function



const privateKey = fs.readFileSync('./keys/private_key.pem', 'utf8');
const certificate = fs.readFileSync('./keys/certificate.pem', 'utf8');
const credentials = { key: privateKey, cert: certificate };
const app = express();
app.set('view engine', 'ejs');
const port = 3000;

// Serve static files from the 'public' directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json())
app.use(cookieParser());
dotenv.config();
const upload = multer();



function authenticateToken(req, res, next) {
    const token = req.cookies.token;
    if (token == null) return res.redirect("/login");

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.redirect("/login");
        req.user = user;
        next();
    });
}

async function userLoggedIn(req) {
    const token = req.cookies.token;
    if (token == null || token == "") return false;
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return false;
        req.user = user;
        return true;
    });
}

app.get('/get', authenticateToken, async(req, res) => {
    console.assert("" != req.query.id);
    console.assert("" != req.query.what);
    var uuid = req.query.id;
    var what = req.query.what;
    var obj = await metax.get(uuid);
    obj = JSON.parse(obj);
    res.json({"uuid": obj[what]})
})


app.get('/', authenticateToken, async (req, res) => {
    await userLoggedIn(req)
    const userIsLogged = req.user ? true : false;
    const username = req.user ? req.user.username : null;
    console.assert("" != username)
    var user = await getUser(username);
    const publicationPromises = user.publications.map(async (post) => {
        let pub = await metax.get(post);
        pub = JSON.parse(pub);
        return pub;
    });
    var interests = await getInterestsList();
    const publications = await Promise.all(publicationPromises);
    
    res.render("feed", { user: user, publications: publications, interests: interests});
});

app.get('/settings', authenticateToken, async (req, res) => {
    await userLoggedIn(req);
    const userIsLogged = req.user ? true : false;
    const username = req.user ? req.user.username : null;
    console.assert("" != username)
    var user = await getUser(username);
    var interests = await getInterestsList();
    res.render("settings", { user: user, interests: interests});
});


app.get('/login', async (req, res) => {
    await userLoggedIn(req);
    var userIsLogged = req.user ? true : false;
    if (userIsLogged) {
        return res.redirect('/')
    }
    res.render('login_register');
});

app.post("/register", async (req, res) => {
    var {username, email, password} = req.body;
    password = sha256Hash(password);
    var user = await registerUser(username, email, password)
    if (user.error) {
        return res.json({"error": user.error})
    }
    if (user) {
        return res.json({"success": "Աւգտատէրը յաջողութեամբ գրանցուած է."})
    }
});

app.post("/login", async (req, res) => {
    // if (userLoggedIn(req)) return res.redirect("/")
    var {username, password} = req.body;
    password = sha256Hash(password);
    var user = await loginUser(username, password)
    if (!user) {
        return res.json({"error": "Աւգտատէրը չի գտնուել։"})
    }
    if (user.error) {
        return res.json({"error": user.error})
    }
    if (user) {
        const token = jwt.sign({ username: user.username, email: user.email, uuid: user.uuid }, process.env.JWT_SECRET, { expiresIn: '2h' });
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7200000
        });
        return res.status(200).json({ success: 'Դուք յաջողութեամբ մուտք գործեցիք:' });
    }
});

app.get('/logout', (req, res) => {
    res.cookie('token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 0 // Set to 0 to delete the cookie
    });
    return res.redirect("/");
});

app.post('/create-publication', upload.array('media'), async (req, res) => {
    await userLoggedIn(req);
    const { title, content, hashtags, access } = req.body;
    const files = req.files;
    var userIsLogged = req.user ? true : false;
    if (!userIsLogged) {
        return res.json({"error": "Յայտարարութիւն աւելացնելու համար նախ մուտք գործէք համակարգ։"})
    }
    await createPublication(req.user.username, title, content, files, hashtags, access)
    res.json({ message: 'Post created successfully!', files });
});

app.get("/search", authenticateToken, async (req, res) => {
    await userLoggedIn(req);
    const username = req.user ? req.user.username : null;
    console.assert("" != username)
    var user = await getUser(username);
    var users = await getUsers();
    var finded_users = []
    for (const key in users) {
        if (users.hasOwnProperty(key)) {
            var finded_user = await metax.get(users[key])
            finded_user = JSON.parse(finded_user);
            if (finded_user.username.includes(req.query.query)) {
                if (finded_user.username != user.username) {
                    finded_users.push(finded_user);
                }
            }
        }
    }
    var interests = await getInterestsList();
    res.render("search", { query: req.query.query, user: user, interests: interests, users: finded_users })
})

app.get("/send_friend_request", authenticateToken, async (req, res) => {
    await userLoggedIn(req);
    const username = req.user ? req.user.username : null;
    console.assert("" != username)
    var user_uuid = req.query.to
    var from = await getUser(username);
    var to = await getUserByUUID(user_uuid);

    if (from && to) {
        try {
            if (!(from.sent_friend_requests.includes(to.uuid))){
                from.sent_friend_requests.push(to.uuid)
                await saveObject(from.uuid, from)
            }
            if (!(to.get_friend_requests.includes(from.uuid))){
                to.get_friend_requests.push(from.uuid)
                await saveObject(to.uuid, to)
            }
            return res.json({"success": "Յաջողութեամբ ուղարկուած է։"})
        }catch {
            return res.json({"error" : "Տեղի է ունեցել սխալ, խնդրում ենք փորձել կրկին։"})
        }
    }else {
        console.log(to)
    }
})

app.get("/cancel_friend_request", authenticateToken, async (req, res) => {
    await userLoggedIn(req);
    const username = req.user ? req.user.username : null;
    console.assert("" != username)
    var user_uuid = req.query.to
    var from = await getUser(username);
    var to = await getUserByUUID(user_uuid);

    if (from && to) {
        try {
            if ((from.sent_friend_requests.includes(to.uuid))){
                from.sent_friend_requests = from.sent_friend_requests.filter(uuid => uuid !== to.uuid);
                await saveObject(from.uuid, from)
            }
            if ((to.get_friend_requests.includes(from.uuid))){
                to.get_friend_requests = to.get_friend_requests.filter(uuid => uuid !== to.uuid);
                to.get_friend_requests.push(from.uuid)
                await saveObject(to.uuid, to)
            }
            return res.json({"success": "Յաջողութեամբ ջնջուած է։"})
        }catch {
            return res.json({"error" : "Տեղի է ունեցել սխալ, խնդրում ենք փորձել կրկին։"})
        }
    }else {
        console.log(to)
    }
})


const httpsServer = https.createServer(credentials, app);


httpsServer.listen(port, async () => {
    await connectToMetax("realschool.am", 542, privateKey, certificate);
    console.log(`App listening at http://localhost:${port}`);
});