const puppeteer = require("puppeteer");

const Script = async (Proxy) => {
	const browser = await puppeteer.launch({
		headless: true,
		args: [
			"--no-sandbox",
			"--disable-setuid-sandbox",
			`--proxy-server=http://${Proxy}`,
		],
	});
	const page = await browser.newPage();
	await page.goto("https://api.ipify.org");
	await page.waitForSelector("pre");
	const Oring = await page.evaluate(async () => {
		const From = await document.querySelector("pre").textContent;
		return From;
	});
	await browser.close();
	return { Orign: Oring };
};

module.exports = Script;
