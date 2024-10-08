import metax from './public/js/metax.mjs';
import crypto from 'crypto';

const __falseUUID = "df868f39-896b-431b-b699-e71b4233eaf8";
const __trueUUID = "b4598a37-3126-42c1-a7b2-2906b12989f8";
const MITANIQ_MAIN_TYPE_UUID = "43084444-b491-4f23-8b22-e1391a2c9095-d9ae372d-c257-4ba4-a194-b8c0cf7b3d3e"
const USER_TYPE_UUID = "67f41966-e469-4b0d-b370-303350e5e2dd-5dfe6229-78a6-4954-b20c-9919e8c1834a"
const PUBLICATION_TYPE_UUID = "23297fe7-30cb-45b1-af89-c815f0770850-e048581d-4333-4963-80d5-8d28497b8f5c" // TODO
const ALL_USERS_UUID = "40f6ca3c-2c41-4d4f-a5e4-d26dccd7cb08-6172105f-a02c-4177-8c5f-55dab66251c4"
const PHOTO_TYPE_UUID = "d624d8cd-ead7-423f-b7e6-622a5a9b00fb-72bcb422-47e3-446b-960b-d9b9893f9c73"
const VIDEO_TYPE_UUID = "0b9c39c6-a743-474d-af86-cc2c0f1fdc48-4173ef42-b2da-4204-a466-7756d71bad74"



let INTERESTS = {};
export async function connectToMetax(host, port, privateKey, certificate) {
    await metax.connect(host+":"+port, privateKey, certificate);
    var interests = await getInterestsList();
    interests.forEach(async(uuid) => {
        var name = await getByUUID(uuid, "name", "hye_AM")
        if (!uuid.error) {
            INTERESTS[name] = uuid;
        }
    })
}

function __isProperty(propSpec) {
    return ("id" in propSpec) && ("name" in propSpec) && ("value_type" in propSpec);
}

function __isMandatory(propSpec) {
    console.assert(__isProperty(propSpec));
    if ("mandatory" in propSpec && propSpec.mandatory) { 
            console.assert(-1 != [__falseUUID, __trueUUID].indexOf(propSpec.mandatory));
            return propSpec.mandatory === __trueUUID;
    }
    return false;
}

export async function getCollectionFrom(uuid, collection) {
    try {
        var base = await metax.get(uuid);
        base = JSON.parse(base);

        if (base[collection]) {
            return base[collection]
        }
        return {"error": "Չի գտնուել։"}
    }catch {
        return {"error": "Տեղի է ունեցել սխալ, խնդրում ենք փորձել կրկին։"}
    }
}

export async function addToCollection(base_uuid, collection, data_uuid) {
    try {
        var base = await metax.get(base_uuid);
        base = JSON.parse(base);
        console.log(base, collection)

        if (!base[collection]) {
            return {"error": "Չի գտնուել։"}
        }
        base[collection].push(data_uuid)
        await metax.update(base_uuid, JSON.stringify(base), "application/json")
    }catch {
        return {"error": "Տեղի է ունեցել սխալ, խնդրում ենք փորձել կրկին։"}
    }
}

async function createNewObject(uuid) {
    var typeSpec = await metax.get(uuid);
    typeSpec = JSON.parse(typeSpec);

    console.assert("uuid" in typeSpec);
    console.assert("type" in typeSpec);

    var newObject = {}
    typeSpec.properties.forEach((i) => {
        console.assert("id" in i);
        console.assert("value_type" in i);
        console.assert("mandatory" in i);
        newObject[i.id] = "";
        if (i.id === "name") {
            newObject.name = "Նոր " + typeSpec.name.hye_AM;
        }
        if (i.default_value != "") {
            newObject[i.id] = i.default_value
        }
    });
    console.assert("name" in typeSpec);
    console.assert("name" in newObject);
    console.assert("id" in typeSpec);
    newObject.type = typeSpec.uuid;
    newObject.uuid = "Pending save in Metax...";
    const date = new Date();
    newObject.date_added = `${date.getFullYear()}-${("0" + (date.getMonth()+1)).slice(-2)}-${("0" + date.getDate()).slice(-2)}`
    console.assert("type" in newObject);
    console.assert("uuid" in newObject);
    typeSpec.collections.forEach((j) => {
        console.assert("id" in j);
        console.assert("element_type" in j);
        newObject[j.id] = [];
    });
    return newObject
}

export async function addNewCollectionItem(owner, type, collection) {
    var new_object = await createNewObject(type);
    var new_uuid = await metax.save(JSON.stringify(new_object), "application/json");
    new_object.uuid = new_uuid;
    await metax.update(new_uuid, JSON.stringify(new_object), "application/json")
    var base = await metax.get(owner);
    base = JSON.parse(base)
    base[collection].push(new_uuid)
    await metax.update(owner, JSON.stringify(base), "text/plain")
    return new_object
}

export async function getUUIDByNameFromCollection(uuid, collection, name) {
    try {
        var typeSpec = await metax.get(uuid);
        typeSpec = JSON.parse(typeSpec);

        var items = typeSpec[collection];
        for (const item of items) {
            var spec = await metax.get(item);
            spec = JSON.parse(spec);
            if (spec.name.hye_AM == name) {
                return item;
            }
        }
        return {"error" : "Չի գտնուել"}
    } catch {
        return {"error" : "Տեղի է ունեցել սխալ, խնդրում ենք փորձել կրկին:"}
    }
}

export async function getByUUID(uuid, property, subproperty=null) {
    try {
        var spec = await metax.get(uuid);
        spec = JSON.parse(spec);
        if (subproperty) {
            return spec[property][subproperty]
        }else {
            return spec[property]
        }
        return {"error" : "Չի գտնուել"}
    } catch {
        return {"error" : "Տեղի է ունեցել սխալ, խնդրում ենք փորձել կրկին:"}
    }
}

export async function getUsers() {
    var users = await metax.get(ALL_USERS_UUID)
    users = JSON.parse(users)
    return users
}


export async function getPublications() {
    var publications = await getCollectionFrom(MITANIQ_MAIN_TYPE_UUID, "publications")
    console.log(publications)
    return publications
}

export async function getUser(username) {
    if (!(await isUserRegistered(username))) {
        return null
    }
    var users = await getUsers();
    var user_uuid = users[username];
    try {
        var user = await metax.get(user_uuid);
        return JSON.parse(user);
    }catch {
        return null;
    }
}

export async function getUserByUUID(uuid) {
    try {
        var user = await metax.get(uuid);
        user = JSON.parse(user)
        if (!(await isUserRegistered(user.username))) {
            return null
        }
        return user;
    }catch {
        return null;
    }
}

async function isUserRegistered(username) {
    console.assert("" != username);
    try {
        var users = await getUsers();
        if (username in users) {
            return true
        }
    } catch {
        return false
    }
}

export async function registerUser(username, email, password) {
    console.assert("" != username);
    console.assert("" != email);
    console.assert("" != password);
    try {
        if (!(await isUserRegistered(username))) {
            var user = await addNewCollectionItem(MITANIQ_MAIN_TYPE_UUID, USER_TYPE_UUID, "users");
            user.username = username;
            user.password = password;
            user.email = email;
            await metax.update(user.uuid, JSON.stringify(user), "application/json")

            var users = await getUsers();
            users[username] = user.uuid
            await metax.update(ALL_USERS_UUID, JSON.stringify(users), "application/json");

            return user;
        }
        return {"error": "Այս աւգտանունով աւգտատէր արդէն կայ գրանցուած."}
    } catch(error) {
        return {"error" : error};
    }
}

export function sha256Hash(data) {
    var hash = crypto.createHash('sha256');
    var sha256_hash = hash.update(data).digest("hex");
    return sha256_hash;
}

export async function loginUser(username, password) {
    console.assert("" != username);
    console.assert("" != password);
    try {
        if (!(await isUserRegistered(username))) {
            return {"error": "Այս աւգտանունով աւգտատէր չկայ գրանցուած:"}
        }
        var user = await getUser(username);
        if (!user) {
            return {"error": "Տեղի է ունեցել սխալ, խնդրում ենք փորձել կրկին:"}
        }
        if (password == user.password) {
            return user
        }else {
            return {"error": "Մուտքագրուած գաղտնաբառը սխալ է:"}
        }
    } catch {
        return {"error": "Տեղի է ունեցել սխալ, խնդրում ենք փորձել կրկին:"}
    }
}

async function savePhotoToMetax(file) {
    try {
        const image_uuid = await metax.save(file.buffer, file.mimetype);
        return image_uuid;
    } catch {
        return {"error": "Տեղի է ունեցել սխալ, խնդրում ենք փորձել կրկին։"}
    }
}

async function saveVideoToMetax(file) {
    try {
        const image_uuid = await metax.save(file.buffer, file.mimetype);
        return image_uuid;
    } catch {
        return {"error": "Տեղի է ունեցել սխալ, խնդրում ենք փորձել կրկին։"}
    }
}

export async function createPublication(username, title, content, files, hashtags, access) {
    console.assert("" != username);
    console.assert("" != title);
    console.assert("" != content);
    try {
        var publications = await getPublications();
        if (!(await isUserRegistered(username))) {
            return {"error": "Այս աւգտանունով աւգտատէր չկայ գրանցուած:"}
        }
        var user = await getUser(username);
        if (!user) {
            return {"error": "Տեղի է ունեցել սխալ, խնդրում ենք փորձել կրկին:"}
        }
        var publication = await addNewCollectionItem(user.uuid, PUBLICATION_TYPE_UUID, "publications")
        publication.name = title;
        publication.content = content;
        publication.author = user.uuid;
        if (access == 1) {
            publication.access = __trueUUID;
        }else {
            publication.access = __falseUUID;
        }
        for (const tag of hashtags) {
            if (INTERESTS[tag]) {
                publication.classes.push(INTERESTS[tag])
            }
        }
        for (const file of files) {
            var mimeType = file.mimetype;
            if (mimeType.startsWith('image/')) {
                try {
                    var image_uuid = await savePhotoToMetax(file);
                    var data = await addNewCollectionItem(publication.uuid, PHOTO_TYPE_UUID, "photos");
                    data.photo = image_uuid;
                    data.author = user.uuid;
                    await metax.update(data.uuid, JSON.stringify(data), "application/json");
                    publication.photos.push(data.uuid);
                } catch (error) {
                    console.error('Error handling image:', error);
                }
            } else if (mimeType.startsWith('video/')) {
                try {
                    var video_uuid = await saveVideoToMetax(file);
                    var data = await addNewCollectionItem(publication.uuid, VIDEO_TYPE_UUID, "videos");
                    data.video = video_uuid;
                    data.author = user.uuid;
                    await metax.update(data.uuid, JSON.stringify(data), "application/json");
                    publication.videos.push(data.uuid);
                } catch (error) {
                    console.error('Error handling video:', error);
                }
            }
        }
        if (access == 1) {
            console.log(access)
            await addToCollection(MITANIQ_MAIN_TYPE_UUID, "publications", publication.uuid)
        }
        await metax.update(publication.uuid, JSON.stringify(publication), "application/json");

        return publication

    } catch (e) {
        console.log(e)
        return {"error": "Տեղի է ունեցել սխալ, խնդրում ենք փորձել կրկին:"}
    }
}

export async function getInterestsList(){
    try {
        var mitaniq = await metax.get(MITANIQ_MAIN_TYPE_UUID)
        mitaniq = JSON.parse(mitaniq)
        var interests = mitaniq.interests
        return interests
    }catch {
        return {"error": "Տեղի է ունեցել սխալ, խնդրում ենք փորձել կրկին:"}
    }
}

export async function saveObject(uuid, object) {
    await metax.update(uuid, JSON.stringify(object), "application/json")
}


export default metax