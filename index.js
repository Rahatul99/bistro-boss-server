const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const port = process.env.PORT || 5000;


//middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if(!authorization){
    return res.status(401).send({error: true, message: 'unauthorized access'});
  }

  //bearer token(authorization have this token, there are also some text with so that we split it(cause=> bearer: 0, token:...))
  const token = authorization.split(' ')[1];


  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if(err){
      return res.status(401).send({error: true, message: 'unauthorized access'})
    }
    req.decoded = decoded;
    next();
  })
}


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jp6ok1r.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const menuCollection = client.db('bistroDB').collection('menu');
    const reviewCollection = client.db('bistroDB').collection('reviews');
    const cartCollection = client.db('bistroDB').collection('carts');

    const usersCollection = client.db('bistroDB').collection('users');


    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })

      res.send({ token })
    })

    //warning: use verifyJWT before using verify admin 
    const verifyAdmin = async(req, res, next) =>{
      const email = req.decoded.email;
      const query = {email: email}
      const user = await usersCollection.findOne(query);
      if(user?.role !== 'admin'){
        return res.status(403).send({error: true, message: 'forbidden message'})
      }
      next();
    }

    //user related apis
    app.get('/users',verifyJWT, verifyAdmin ,async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    })




    app.post('/users', async(req, res) => {
      const user = req.body;
      const query = {email: user.email}
      const existingUser = await  usersCollection.findOne(query);
      if(existingUser){
        return res.send({message: 'user already exists'})
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    })

    //check is user admin or not
    // app.get('/users/admin/:email',async(req, res) => {
    //   const email = req.params.email;
    //   const query = {email: email}
    //   const user = await usersCollection.findOne(query);
    //   const result = { admin: user?.role === 'admin' }
    //   res.send(result);
    // })

    //above simply check is secondary email is admin or not(but we dint check first email is valid admin or not)
    //security layer: verifyJWT
    //email same
    //check admin
    app.get('/users/admin/:email',verifyJWT ,async(req, res) => {
      const email = req.params.email;


      if(req.decoded.email !== email){
        res.send({ admin: false })
      }

      const query = {email: email}
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })




    app.patch('/users/admin/:id', async(req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    })
    
    //menu related apis
    app.get('/menu', async(req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    })

    app.post('/menu', verifyJWT, verifyAdmin, async(req, res) => {
      const newItem = req.body;
      const result = await menuCollection.insertOne(newItem);
      res.send(result);
    })

    app.delete('/menu/:id',verifyJWT, verifyAdmin ,async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    })

    //review related apis
    app.get('/reviews', async(req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    })

    //cart collection apis
    app.get('/carts', verifyJWT, async(req, res) => {
      const email = req.query.email;
      if(!email){
        res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if(email !== decodedEmail){
        return res.status(403).send({error: true, message: 'forbidden access'})
      }

      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });



    app.post('/carts', async(req, res) => {
      const item = req.body;
      console.log(item);
      const result = await cartCollection.insertOne(item);
      res.send(result);
    })

    app.delete('/carts/:id', async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query)
      res.send(result);
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error

    // await client.close();
  }
}

run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('boos is sitting')
})

app.listen(port, () => {
    console.log(`Bostro boss is sitting on port ${port}`);
})



/**
 * --------------------------
 *      NAMING CONVENTION
 * --------------------------
 * users : userCollection
 * app.get('/users')
 * app.get('/users/:id')
 * app.post('/users') (create one or many most of the case one)
 * app.patch('/users/:id') (update one)
 * app.put('/users:id') (update one)
 * app.delete('/users/:id') (update one)
 * **/