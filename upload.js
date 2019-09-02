app.post('/upload/:id', function(request, response) {
    var form = new formidable.IncomingForm();
    logger.info('/upload/'+request.params.id);
    form.parse(request, function(err, fields, files) {
        if (err) {
            logger.error('file upload error', files.multipartFile.name, err.message);
            response.write(JSON.stringify({“result”:false, “data”: {“filename”: files.multipartFile.name}, “error”:err.message}));
            response.end();
            return;
        }
        var uploadFolder = '/DATA1/VCS/thumbnail/';
        var oldpath = files.multipartFile.path;
        var newpath = uploadFolder + files.multipartFile.name;
        fs.rename(oldpath, newpath, function (err) {
            if (err) {
                logger.error('file rename error', files.multipartFile.name, err.message);
                response.write(JSON.stringify({“result”:false, “data”: {“filename”: files.multipartFile.name}, “error”:err.message}));
                response.end();
                return;
            }

            var query = util.format(“INSERT INTO TB_THUMBIMG_ANA_HISTORY ( P_CUST_CTN, P_INSERT_DATE, IMG_FILE_NM, INSERT_DATE) ” +
            “SELECT CUST_CTN, INSERT_DATE, '%s', DATE_FORMAT(now(),'%%Y%%m%%d%%H%%i%%s') ” +
            “FROM TB_TERMINAL_IMAGE_TRANS ” +
            “WHERE CUST_CTN='%s' and UPLOAD_FILE_NM like '%s%'“, newpath, request.params.id, files.multipartFile.name.split('_')[0]);

            dbConn.query(query, function(err, results, fields) {
                logger.info('Query:', query);
                if (err) {
                    logger.error('DB Error:', err);
                    response.write(JSON.stringify({“result”:false, “data”: {“filename”: files.multipartFile.name}, “error”:err.message}));
                    response.end();
                    return;
                }
                response.writeHead(200, {'content-type': 'application/json'});
                response.write(JSON.stringify({“result”:true, “data”: {“filename”: files.multipartFile.name}, “error”:null}));
                logger.info(util.inspect({fields: fields, files: files}));
                response.end();
            });
        });
    });
});