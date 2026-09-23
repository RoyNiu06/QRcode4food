import { test } from "node:test";
import assert from "node:assert/strict";
import { validateContribution, validateContributionWindows, validateRaffleSettings, validateRestaurant, validateUrl, validateWindow } from "../shared/validation";
import {
  imageType,
  passwordHash,
  equal,
  randomToken,
} from "../worker/security";
import QRCode from "qrcode";

test("merchant URL signatures, query order and fragments survive unchanged", () => {
  const value = "https://example.com/order?b=2&a=%2f%2B#menu";
  assert.equal(validateUrl(value), value);
});
test("script, credential, local and literal IP URLs cannot be published", () => {
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,hello",
    "file:///a",
    "https://u:p@example.com",
    "https://localhost/a",
    "https://127.0.0.1/a",
    "http://2130706433/",
    "http://[::1]/",
    "https://shop.local/",
    "abc",
  ])
    assert.throws(() => validateUrl(value), value);
});
test("publish only requires a name; optional metadata and URL may be omitted", () => {
  const data = {
    name: "示例餐厅",
    address: "",
    category: "中餐",
    description: "",
    url: "https://example.com",
    status: "published",
    verified: true,
    sort_order: 0,
  };
  assert.equal(validateRestaurant(data).name, "示例餐厅");
  assert.equal(
    validateRestaurant({
      name: "简体",
      name_zh_hant: "繁體",
      name_en: "English",
      status: "published",
    }).name_en,
    "English",
  );
  assert.throws(() =>
    validateRestaurant({
      name: "简体",
      name_en: "x".repeat(81),
      status: "published",
    }),
  );
  assert.equal(
    validateRestaurant({ name: "仅店名", status: "published" }).url,
    "",
  );
  assert.equal(
    validateRestaurant({ name: "仅店名", status: "published" }).address,
    "",
  );
  assert.equal(validateRestaurant({ name: "仅店名" }).category, "其他");
  assert.equal(
    validateRestaurant({ ...data, url: "  ", verified: false }).url,
    "",
  );
  assert.equal(validateRestaurant({ ...data, verified: false }).url, data.url);
  assert.throws(() =>
    validateRestaurant({ ...data, url: "javascript:alert(1)" }),
  );
  assert.throws(() => validateRestaurant({ ...data, name: "" }));
  assert.throws(() => validateRestaurant({ ...data, sort_order: -1 }));
  assert.throws(() => validateRestaurant({ ...data, status: "anything" }));
});
test("counter and visitor submissions require names and reject unsafe links", () => {
  assert.equal(validateWindow({ name: "面食窗口", url: "" }).url, "");
  assert.equal(validateContribution({ restaurant_name: "食堂", url: "" }).restaurant_id, null);
  assert.throws(() => validateWindow({ name: "", url: "https://example.com" }));
  assert.throws(() => validateWindow({ name: "窗口", url: "javascript:alert(1)" }));
  assert.throws(() => validateContribution({ restaurant_name: "食堂", restaurant_id: "bad" }));
});
test("rich contributions accept optional main QR, translations, notes and multiple counters", () => {
  const proposal=validateContribution({mode:"restaurant",include_main:false,restaurant_name:"新食堂",
    name_zh_hant:"新食堂",name_en:"New Canteen",category:"中餐",
    opens_app:true,wechat_mini_program:true,other_note:"另有自助机",other_note_en:"Self-service kiosk"});
  assert.equal(proposal.include_main,false);
  assert.equal(proposal.name_en,"New Canteen");
  assert.equal(proposal.opens_app,1);
  assert.equal(proposal.wechat_mini_program,1);
  assert.equal(proposal.other_note_en,"Self-service kiosk");
  const windows=validateContributionWindows([{name:"面食",url:"https://example.com/noodles"},{name:"咖啡",url:""}]);
  assert.equal(windows.length,2);
  assert.throws(()=>validateContribution({mode:"update",include_main:false,restaurant_name:"食堂"}));
  assert.throws(()=>validateContributionWindows([{name:"",url:"https://example.com"}]));
  assert.throws(()=>validateContributionWindows([{name:"窗口",url:"javascript:alert(1)"}]));
});
test("raffle easter egg can be disabled and limits custom lines", () => {
  assert.equal(validateRaffleSettings({enabled:false,lines_zh_hans:[],lines_zh_hant:[],lines_en:[]}).enabled,false);
  assert.deepEqual(validateRaffleSettings({enabled:true,lines_zh_hans:["再想想？"],lines_zh_hant:[],lines_en:[]}).lines_zh_hans,["再想想？"]);
  assert.throws(()=>validateRaffleSettings({enabled:true,lines_zh_hans:Array(13).fill("一句"),lines_zh_hant:[],lines_en:[]}));
  assert.throws(()=>validateRaffleSettings({enabled:true,lines_zh_hans:["x".repeat(121)],lines_zh_hant:[],lines_en:[]}));
});
test("password hashing uses salt and secret pepper, and tokens have enough entropy", async () => {
  const a = await passwordHash("sample-password", "salt1", "pepper1");
  assert.equal(a.length, 64);
  assert.equal(
    equal(a, await passwordHash("sample-password", "salt1", "pepper1")),
    true,
  );
  assert.notEqual(a, await passwordHash("sample-password", "salt2", "pepper1"));
  assert.notEqual(a, await passwordHash("sample-password", "salt1", "pepper2"));
  assert.notEqual(randomToken(), randomToken());
});
test("upload validation recognizes a real QR PNG and rejects active files", async () => {
  const png = await QRCode.toBuffer("https://example.com/menu");
  assert.equal(imageType(png), "image/png");
  assert.equal(
    imageType(
      new TextEncoder().encode(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      ),
    ),
    null,
  );
  const huge = Buffer.from(png);
  huge.writeUInt32BE(100000, 16);
  assert.equal(imageType(huge), null);
});
