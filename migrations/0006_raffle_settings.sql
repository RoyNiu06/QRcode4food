CREATE TABLE raffle_settings (
  id INTEGER PRIMARY KEY CHECK(id=1),
  enabled INTEGER NOT NULL DEFAULT 1,
  lines_zh_hans TEXT NOT NULL,
  lines_zh_hant TEXT NOT NULL,
  lines_en TEXT NOT NULL
);
INSERT INTO raffle_settings(id,enabled,lines_zh_hans,lines_zh_hant,lines_en) VALUES(
  1,1,
  '["都第五次了，今天的菜单还在等你拍板。","命运已经很努力了，这次就吃它吧。","再抽一次，饭点可就不等人啦。"]',
  '["都第五次了，今天的菜單還在等你拍板。","命運已經很努力了，這次就吃它吧。","再抽一次，飯點可就不等人啦。"]',
  '["Five draws in. Your dinner is waiting for a decision.","Fate has tried its best. How about this one?","One more draw? Dinner will not wait forever."]'
);
