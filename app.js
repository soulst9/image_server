/*jshint esversion: 8 */

const express = require("express");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const multer = require("multer");
const fetch = require("node-fetch");

const MAX_UPLOAD_COUNT = 4;
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

const app = express();
const upload = multer({
  limits: { fileSize: MAX_UPLOAD_SIZE }
});

const errorMsg = {
  ClientError: {
    "0000": `파일 크기는 최대 ${MAX_UPLOAD_SIZE}Bytes 로 제한합니다.`,
    "0001": `업로드 파일 갯수는 ${MAX_UPLOAD_COUNT}개를 초과할 수 없습니다.`,
    "0002": "결과 보고 요청 서버가 응답하지 않습니다.",
    "0003": "폴더가 존재하지 않습니다.",
    "0004": "파일이 존재하지 않습니다.",
    "0005": "",
    "0006": "업로드에 실패하였습니다.",
    "0007": "결과 보고 서버에서 오류로 응답하였습니다.",
    "0008": "중요한 키가 누락되었습니다.",
    "0009": "존재하지 않는 앨범 이름입니다.",
    "0010": "JSON 형식에 오류가 존재합니다",
    "9998": "시스템 오류입니다.",
    "9999": "알려지지 않은 오류입니다."
  }
};

const IMAGES_ROOT_PATH = "/Users/banzry_Mac/images";

const MIMETYPE = ["image/jpeg", "image/png", "image/webp", "image/gif"];

app.post("/upload", async (req, res) => {
  // max count
  const uploadfile = upload.array("uploadfile", MAX_UPLOAD_COUNT);
  uploadfile(req, res, async function(err) {
    if (err) {
      let message;
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        message = errorMsg.ClientError["0001"];
      } else if (err.code === "LIMIT_FILE_SIZE") {
        message = errorMsg.ClientError["0000"];
      } else {
        message = errorMsg.ClientError["9999"];
      }
      res.status(400).json({ error: message });
      return;
    }

    if (!req.body.Album && !req.body.Key) {
      res.status(400).json({ error: errorMsg.ClientError["0008"] });
    }

    if (!fs.existsSync(path.join(IMAGES_ROOT_PATH, req.body.Album))) {
      res.status(400).json({ error: errorMsg.ClientError["0009"] });
    }

    // if (isValidKey(req.body.Key)) {
    //   res.status(400).json({ error: errorMsg.ClientError["0005"] });
    // }

    // const filepath = makeDir([IMAGES_ROOT_PATH, req.body.Album, req.body.Key]);
    const filepath = makeDir(
      path.join(IMAGES_ROOT_PATH, req.body.Album),
      req.body.Key
    );
    console.log("-----", filepath);
    const results = await saveImages(filepath, req.files);

    if (results.length) {
      // 이미지 변환 후 저장 결과 보고
      // for (const result of results) {
      //   const body = {
      //     album: req.body.Album,
      //     key: req.body.Key,
      //     size: result.size,
      //     width: result.width,
      //     height: result.height,
      //     originalname: result.originalname,
      //     filename: result.finalname,
      //     filepath: result.filepath
      //   };
      //   const { data, error } = await notification(req.body.report_url, body);
      // }
      res.json({
        count: results.length,
        files: selectedkeyReducer(results, ["originalname", "finalname"])
      });
    } else {
      res.status(500).json({ error: errorMsg.ClientError["0006"] });
    }
  });
});

app.put("/images/:tabmenu/:year/:month/:day/:id", async (req, res) => {
  let path_arr = [];
  path_arr.push(IMAGES_ROOT_PATH);
  path_arr.push(req.params.tabmenu);
  path_arr.push(req.params.year);
  path_arr.push(req.params.month);
  path_arr.push(req.params.day);
  path_arr.push(req.params.id);

  const filepath = path_arr.join("/");
  console.log(filepath);

  fs.readdir(filepath, (err, files) => {
    if (err) {
      if (err.code === "ENOENT") {
        res.status(400).json({ error: errorMsg.ClientError["0003"] });
      }
      return;
    }
    console.log("file count : ", files.length);
    const fileCount = files.length;
    const uploadfile = upload.array("uploadfile", MAX_UPLOAD_COUNT - fileCount);
    uploadfile(req, res, async function(err) {
      if (err) {
        let message;
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          message = errorMsg.ClientError["0000"];
        } else if (err.code === "LIMIT_FILE_SIZE") {
          message = errorMsg.ClientError["0001"];
        } else {
          message = errorMsg.ClientError["9999"];
        }

        res.status(400).json({ error: message });
        return;
      }

      let results = await saveImages(filepath, req.files);
      if (results.length) {
        res.json({ count: results.length, files: results });
      } else {
        res.status(500).json({ error: errorMsg.ClientError["0006"] });
      }
    });
  });
});

app.get("/folders/:Album/*", async (req, res) => {
  const folder_arr = folderstoUrl(req.params.Album, req.params["0"]);
  const filepath = folder_arr.join("/");

  if (!fs.existsSync(filepath)) {
    res.status(400).json({ error: errorMsg.ClientError["0004"] });
    return;
  }

  if (!fs.existsSync(filepath)) {
    res.status(400).json({ error: errorMsg.ClientError["0003"] });
    return;
  }

  fs.readdir(filepath, (err, files) => {
    if (err) {
      if (err.code === "ENOENT") {
        res.status(400).json({ error: errorMsg.ClientError["0003"] });
      }
      return;
    }

    let results = [];
    files.forEach(file => {
      const fileStat = fs.statSync(path.join(filepath, file));
      const type = fileStat.isDirectory() ? "folder" : "file";
      let fileInfo = {};
      fileInfo.type = type;
      fileInfo.name = file;
      results.push(fileInfo);
    });
    res.json({ count: files.length, list: results });
  });
});

app.get("/images/:Album/*", async (req, res) => {
  console.log(req.params);
  try {
    const folder_arr = folderstoUrl(req.params.Album, req.params["0"]);
    const filepath = folder_arr.join("/");
    console.log(filepath);
    if (!fs.existsSync(filepath)) {
      res.status(400).json({ error: errorMsg.ClientError["0004"] });
      return;
    }

    const width = Number(req.query.width);
    const new_width = Number.isInteger(width) ? width : undefined;
    const rfs = fs.createReadStream(filepath);
    const roundedCornerResizer = sharp()
      .resize({
        width: new_width,
        fit: sharp.fit.inside,
        withoutEnlargement: true
      })
      .webp();
    rfs.pipe(roundedCornerResizer).pipe(res);
  } catch (err) {
    console.log("error", err);
    res.status(400).json({ error: "file resize failed" });
  }
});

app.delete("/images/:Album/:Key/:filename", async (req, res) => {
  let path_arr = [];
  path_arr.push(IMAGES_ROOT_PATH);
  path_arr.push(req.params.Album);
  path_arr.push(req.params.Key);
  path_arr.push(`${req.params.filename}.webp`);

  const filepath = path_arr.join("/");
  console.log(filepath);

  if (!fs.existsSync(filepath)) {
    res.status(400).json({ error: errorMsg.ClientError["0004"] });
    return;
  }

  fs.unlink(filepath, err => {
    if (err) {
      console.error(err);
      res.status(500).json({
        error: errorMsg.ClientError["9999"]
      });
      return;
    }
    res.status(204).json({});
  });
});

app.use(function(err, req, res, next) {
  console.error("error handler", err.stack);
  res.status(500).json({ message: errorMsg.ClientError["9998"] });
});

const notification = async (url, data) => {
  try {
    const result = await fetch(url, {
      method: "post",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    console.log(result);
    const json = await result.json();
    if (result.status == 200) {
      return { data: json };
    }
    console.log(json);
    let error = new Error(errorMsg.ClientError["0007"]);
    return { error };
  } catch (error) {
    error.message = errorMsg.ClientError["0002"];
    return { error };
  }
};

const saveImages = async (filepath, files) => {
  let resultAll = [];
  for (const file of files) {
    const result = await savetoWebp(filepath, file);
    if (result) {
      result.originalname = file.originalname;
      result.originalformat = extention(file.originalname);
      result.finalname = rename(file.originalname);
      result.filepath = symboliclink(filepath);
      resultAll.push(result);
    }
  }
  return resultAll;
};

const savetoWebp = (filepath, file) => {
  return sharp(file.buffer)
    .webp({ alphaQuality: 60 })
    .toFile(path.join(filepath, rename(file.originalname)))
    .catch(err => {
      console.log(err);
    });
};

const folderstoUrl = (Album, KeyUrl) => {
  const filepath_arr = KeyUrl.split("/");
  const filename = rename(filepath_arr.slice(-1)[0]);
  filepath_arr.pop();

  return [IMAGES_ROOT_PATH, Album, ...filepath_arr, ...[filename]];
};

const symboliclink = filepath => filepath.replace(IMAGES_ROOT_PATH + "/", "");

const extention = filename => path.parse(filename).ext.replace(".", "");
const rename = originalname => `${path.parse(originalname).name}.webp`;

const imageDir = id => {
  let path_arr = [];
  path_arr.push(IMAGES_ROOT_PATH);
  path_arr.push(DEF_TAB_PRODUCT);

  // tab menu
  makeDir(path_arr);

  const now = new Date();
  // year directory
  path_arr.push(now.getFullYear());
  makeDir(path_arr);

  // month directory
  path_arr.push((now.getMonth() + 1).toString().padStart(2, "0"));
  makeDir(path_arr);

  // day directory
  path_arr.push(
    now
      .getDate()
      .toString()
      .padStart(2, "0")
  );
  makeDir(path_arr);

  // _id directory
  path_arr.push(id);
  makeDir(path_arr);

  return path_arr.join("/");
};

const makeDir = (albumPath, key) => {
  let path_arr = [albumPath],
    filepath = "";

  const folders = key.split("/");
  folders.forEach(subfolder => {
    path_arr.push(subfolder);
    filepath = path_arr.join("/");
    if (!fs.existsSync(filepath)) {
      fs.mkdirSync(filepath);
    }
  });
  return filepath;
};

const selectedkeyReducer = (objectArray, selectedkeyArray) => {
  return objectArray.reduce((accumulator, value, index, array) => {
    let newObject = {};
    Object.keys(value).forEach(key => {
      if (selectedkeyArray.includes(key)) {
        newObject[key] = value[key];
      }
    });
    accumulator.push(newObject);
    return accumulator;
  }, []);
};

// const isNumeric = n => !isNaN(parseFloat(n)) && isFinite(n);

module.exports = app;
