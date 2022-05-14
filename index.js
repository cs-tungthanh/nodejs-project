const express = require("express");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();

const mongoose = require("mongoose");
const uri = process.env.MONGO_URI || "";
mongoose
    .connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        console.log("connected to the db");
    })
    .catch((err) => {
        console.log("connection failed " + err);
    });

app.use(cors());
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

// parse application/json
app.use(bodyParser.json());

app.use("/public", express.static(`${process.cwd()}/public`));
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/views/index.html");
});

let userSchema = new mongoose.Schema({
    username: { type: String, required: true },
});
const UserModel = mongoose.model("users", userSchema);

let exerciseSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    description: { type: String, required: true },
    duration: { type: String, required: true },
    date: { type: String, required: true },
});
const ExerciseModel = mongoose.model("exercises", exerciseSchema);

app.post("/api/users", (req, res) => {
    if (!req.body.username || req.body.username.length === 0) {
        res.status(404).send("username is required");
        return;
    }
    try {
        const newUser = new UserModel({
            username: req.body.username || "default",
        });
        newUser.save();
        res.json({
            username: newUser.username,
            _id: newUser._id,
        });
    } catch (error) {
        res.status(404).send("add failed");
    }
});

app.post("/api/users/:id/exercises", async (req, res) => {
    const userId = req.params.id;
    const { description, duration, date } = req.body;
    if (!userId) {
        return res.status(404).send("id is required");
    }
    if (description === "") {
        return res.json({ error: "description is required" });
    }
    if (duration === "") {
        return res.json({ error: "duration is required" });
    }
    try {
        const user = await UserModel.findById(userId);
        if (user) {
            const newExercise = new ExerciseModel({
                description: description,
                duration: duration,
                date: date,
                userId: userId,
            });
            newExercise.save();
            res.json({
                username: user.username,
                description: newExercise.description,
                duration: newExercise.duration,
                date: new Date(newExercise.date).toDateString(),
                _id: newExercise.userId,
            });
        }
    } catch (error) {
        res.status(400).send({ msg: "User is not found" });
    }
});

app.get("/api/users/:_id/logs", async (req, res) => {
    const userId = req.params._id;
    if (!userId) {
        return res.json({ error: "userId is required" });
    }
    let findConditions = { userId: userId };

    if (
        (req.query.from !== undefined && req.query.from !== "") ||
        (req.query.to !== undefined && req.query.to !== "")
    ) {
        findConditions.date = {};

        if (req.query.from !== undefined && req.query.from !== "") {
            findConditions.date.$gte = new Date(req.query.from);
        }

        if (req.query.to !== undefined && req.query.to !== "") {
            findConditions.date.$lte = new Date(req.query.to);
        }
    }

    const limit = req.query.limit !== "" ? parseInt(req.query.limit) : 0;

    UserModel.findById(userId, function (err, data) {
        if (!err && data !== null) {
            ExerciseModel.find(findConditions)
                .sort({ date: "asc" })
                .limit(limit)
                .exec(function (err2, data2) {
                    if (!err2) {
                        return res.json({
                            username: data["username"],
                            _id: data["_id"],
                            log: data2.map(function (e) {
                                return {
                                    description: e.description,
                                    duration: e.duration,
                                    date: e.date,
                                };
                            }),
                            count: data2.length,
                        });
                    }
                });
        } else {
            return res.json({ error: "user not found" });
        }
    });
});

const listener = app.listen(process.env.PORT || 3000, () => {
    console.log("Your app is listening on port " + listener.address().port);
});
