const express = require("express");
const cookieParser = require('cookie-parser');
const { Sequelize,DataTypes,Op } = require('sequelize');
const urlExist = require('url-exist');

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST,
    dialect: 'postgres',
    logging: true,
});


const Authories = sequelize.define('Authories',{
    id:{
        type: DataTypes.INTEGER,
        allowNull:false,
        primaryKey:true,
        autoIncrement:true,
    },
    password:{
        type:DataTypes.STRING(60),
        allowNull:false
    },
    login:{
        type:DataTypes.STRING(32),
        allowNull:false
    }
    },
);

const References = sequelize.define('References',{
    id:{
        type:DataTypes.INTEGER,
        allowNull:false,
        primaryKey:true,
        autoIncrement:true,
    },
    ref:{
        type:DataTypes.STRING(2083),
        allowNull:false,
    }
    },
)

Authories.hasMany(References);
References.belongsTo(Authories);

sequelize.sync({alter: true});

const createUrlDb = async (url, userId) => {
    try {
        return await References.create({
            ref: url,
            AuthoryId: userId
        });
    } catch (error) {
        console.error("Ошибка:", error);
        return undefined;
    }
};

const findByUrlId = async (urlId,userId) =>{
    try{
        return await References.findOne({
            where:{
                id:urlId,
                AuthoryId: userId  
            }
        })
    }
    catch (error) {
        console.error("Ошибка:", error);
        return undefined;
    }
}

const findUrlInUser = async (url, userId) => {
    try {
        return await References.findOne({
            where: {
                ref: url,
                AuthoryId: userId
            }
        });
    } catch (error) {
        console.error("Ошибка:", error);
        return undefined;
    }
};

const addUrl = async (url, userId) => {
    try {
        const ans = await findUrlInUser(url, userId);
        if (ans) return;
        const ref = await createUrlDb(url, userId);
        return ref.id;
    } catch (error) {
        console.error("Ошибка:", error);
        return undefined;
    }
};


const delReferencesByIdDb = async(urlId)=>{
    return await References.destroy({
        where:{
            
            id:urlId
        }
    })
}

const delReferencesById = async (urlId)=>{
    try{
        let entry = await delReferencesByIdDb(urlId);
        if (entry) {
            return entry;
        }
    }
    catch(error){
        console.error("Ошибка:", error);
        return undefined;
    }
}

const getUrlsByUserIdDb = async (userId)=>{
    return await References.findAll({
        where:{
            AuthoryId:userId
        }
    })
}

const getUrlByUserId = async(userId)=>{
    try{
        const urlList = await getUrlsByUserIdDb(userId);
        const extractedData = urlList.map(item => {
            return {
                id: item.id,
                ref: item.ref
            };
        });
        return extractedData;
    }
    catch(error){
        console.error("Ошибка:", error);
        return undefined;
    }
}

const findUser = async (login,password)=>{
    return await Authories.findOne({
        where:{
            [Op.and]:[
                {login:login},
                {password:password},
            ]
        }
    });
};

const checkAuth = async(login,password)=>{
    try{
        const user = await findUser(login,password);
        if (user){
            return user.id;
        }
        return undefined;
    }
    catch(error){
        console.error("Ошибка:", error);
        return undefined;
    }
};

const createUserDb = async (login,password)=>{
    return await Authories.create({
        login:login,
        password:password
    });
};

const findUserLogin = async (login)=>{
    return await Authories.findOne({
        where:{
            login:login,
        }
    })
}

const createUser = async(login,password)=>{
    try{
        const user = await findUserLogin(login);
        if(user) return;
        const userData = await createUserDb(login,password);
        return userData.id;
    }
    catch(error){
        console.error("Ошибка:", error);
        return undefined;
    }
}

const app = express();
app.use(cookieParser());
app.use(express.urlencoded({extended: true}));

const session = require('express-session');

app.set('trust proxy', 1);
app.use(session({
    secret: 'asda21e2e',
    resave: false,
    saveUninitialized: true,
}));

const { Liquid } = require('liquidjs');
const engine = new Liquid();

app.engine('liquid', engine.express()); 
app.set('views', './views');
app.set('view engine', 'liquid');

const isLogin = (req,res,next)=>{
    if(!req.session?.user?.id){
        return res.redirect("/login");
    }
    next();
}

const isNotAuthorized = (req,res,next)=>{
    if(req.session?.user?.id){
        return res.redirect("/");
    }
    next();
}

app.get("/",(req,res)=>{
    res.redirect("/user");
});

app.get("/login",isNotAuthorized,async(req,res)=>{
    res.render("authorize");
});

app.post("/login",isNotAuthorized,async(req,res)=>{
    const [login,password] = [req.body.login,req.body.password];
    const id = await checkAuth(login,password);
    if(id){
        req.session.user={
            id:id
        }
        return res.redirect("/user");
    }
    return res.redirect("/");
});

app.get("/user/:id?",isLogin,async(req,res)=>{
    const id = req.params.id;
    if(!id){
        const urlList = await getUrlByUserId(req.session?.user?.id);
        return res.render("list",{user:req.session.user,list:urlList});
    }
    const result = await findByUrlId(id,req.session?.user?.id);
    if(result){
        return res.redirect(result.ref);
    }
    res.redirect('/user');
});

app.post("/list",isLogin,async(req,res)=>{
    const url = req.body.url;
    const exist = await urlExist(url);
    if(!exist) return res.redirect("/user");

    const ref = await addUrl(url,req.session?.user?.id);
    if(ref) console.log(`url added № ${ref}`);
    return res.redirect("/user");
})

app.post("/deleteList",isLogin,async(req,res)=>{
    const refId = req.body.ref;
    const answer = await delReferencesById(refId);
    res.redirect("/user");
})

app.get("/reg",isNotAuthorized,(req,res)=>{
    res.render("registration");
});

app.post("/reg",isNotAuthorized,async(req,res)=>{
    const [login,password] = [req.body.login,req.body.password];
    const id = await createUser(login,password);
    if(id){
        req.session.user={
            id:id
        }
        return res.redirect("/user");
    }
    return res.redirect("/");
});

app.get("/logout",isLogin,(req,res)=>{
    console.log(`${req.session?.user?.id} session end`);
    req.session.user = null;
    res.redirect("/");
})
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});