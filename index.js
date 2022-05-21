const express = require('express');
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');

require('dotenv').config();

const mongoose = require('mongoose');
const uri = process.env.MONGO_URI || '';
mongoose
    .connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        console.log('connected to the db');
    })
    .catch((err) => {
        console.log('connection failed ' + err);
    });

app.use(cors());
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
// parse application/json
app.use(bodyParser.json());

app.use('/public', express.static(`${process.cwd()}/public`));
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/views/index.html');
});

/* Creating User Model */
let exerciseSchema = new mongoose.Schema({
    description: { type: String, required: true },
    duration: { type: Number, required: true },
    date: String,
});
let userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    log: [exerciseSchema],
});
let User = mongoose.model('User', userSchema);
let Exercise = mongoose.model('Exercise', exerciseSchema);

/* Creating Users */
app.post('/api/users', (req, res) => {
    let newUser = new User({ username: req.body.username });
    newUser.save((error, savedUser) => {
        if (!error) {
            res.json({ username: savedUser.username, _id: savedUser.id });
        }
    });
});

app.get('/api/users', (req, res) => {
    User.find({}, (error, arrayOfUsers) => {
        if (!error) {
            res.json(arrayOfUsers);
        }
    });
});

/* Creating exercise */
app.post('/api/users/:_id/exercises', (req, res) => {
    const { _id: userId } = req.params;
    let newExerciseItem = new Exercise({
        description: req.body.description,
        duration: parseInt(req.body.duration),
        date: req.body.date,
    });

    if (newExerciseItem.date === undefined || newExerciseItem.date === '') {
        newExerciseItem.date = new Date().toISOString().substring(0, 10);
    }

    User.findByIdAndUpdate(userId, { $push: { log: newExerciseItem } }, { new: true }, (error, updatedUser) => {
        if (!error) {
            let responseObject = {};
            responseObject['_id'] = updatedUser.id;
            responseObject['username'] = updatedUser.username;
            responseObject['description'] = newExerciseItem.description;
            responseObject['duration'] = newExerciseItem.duration;
            responseObject['date'] = new Date(newExerciseItem.date).toDateString();
            res.json(responseObject);
        }
    });
});

app.get('/api/users/:_id/logs', (req, res) => {
    const { _id: userId } = req.params;
    console.log('query', req.query.from, '==', req.query.to, '---', req.query.limit);
    User.findById(userId, (error, result) => {
        if (!error) {
            let resObject = result;

            if (req.query.from || req.query.to) {
                let fromDate = new Date(0);
                let toDate = new Date();
                if (req.query.from) {
                    fromDate = new Date(req.query.from);
                }
                if (req.query.to) {
                    toDate = new Date(req.query.to);
                }
                fromDate = fromDate.getTime();
                toDate = toDate.getTime();

                resObject.log = resObject.log.filter((session) => {
                    let sessionDate = new Date(session.date).getTime();
                    return sessionDate >= fromDate && sessionDate <= toDate;
                });
            }

            if (req.query.limit) {
                resObject.log = resObject.log.filter((d, i) => i < req.query.limit);
            }

            resObject.log.forEach((ex) => {
                ex.date = new Date(ex.date).toDateString();
            });

            resObject = resObject.toJSON();
            resObject['count'] = result.log.length;
            console.log(resObject);
            res.json(resObject);
        }
    });
});

// Not found middleware
app.use((req, res, next) => {
    return next({ status: 404, message: 'not found' });
});

// Error Handling middleware
app.use((err, req, res, next) => {
    let errCode, errMessage;
    if (err.errors) {
        // mongoose validation error
        errCode = 400; // bad request
        const keys = Object.keys(err.errors);
        // report the first validation error
        errMessage = err.errors[keys[0]].message;
    } else {
        // generic or custom error
        errCode = err.status || 500;
        errMessage = err.message || 'Internal Server Error';
    }
    res.status(errCode).type('txt').send(errMessage);
});

const listener = app.listen(process.env.PORT || 3000, () => {
    console.log('listening on port ' + listener.address().port);
});
