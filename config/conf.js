module.exports = {
    jwtSecret: process.env.JWT_SECRET,
    jwtRefreshSecret:process.env.JWT_SECRET_REFRESH_TOKEN,
    port: process.env.PORT || 5001
};
   