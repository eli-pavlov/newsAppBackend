const { createUserMoviesFolder } = require('../services/movies');

let loggedInUser = null;

async function setUser(user) {
    loggedInUser = user;

    await createUserMoviesFolder(getUserId());
}

function getUser(prop=null) {
    if (prop)
        return loggedInUser[prop];

    return loggedInUser;
}

function getUserId(user=null) {
    if (!user)
        user = loggedInUser;

    return String(user?.id ? user.id : user._id);
}

module.exports = {
    getUser,
    setUser,
    getUserId
}
