# HTTPS for phones

Phones only install Hearth as an app, and only receive alerts, from an HTTPS address they trust. `localhost` counts as secure on the computer running Hearth, but a phone reaching `http://10.0.0.205:3000` does not. There are two ways to give Hearth a trusted address.

## On your own network: `npm run dev:https`

```bash
npm run dev:https
```

The first run makes a small private certificate authority in `certs/` (ignored by git). Every run issues a certificate for each address this computer answers on, such as `localhost`, its Wi-Fi IP, and its `.local` name, and reissues it when an address changes or it is a month from expiring. Nothing is added to this computer's keychain. The script prints the address to open on your phone.

Then, once per phone:

**iPhone or iPad** (iOS 16.4 or later for alerts)

1. In Safari, open `https://<your computer's IP>:3000/hearth-ca.crt`. Safari warns that the site is not trusted yet; continue, and allow the download.
2. Open **Settings**, tap **Profile Downloaded**, then **Install**.
3. Open **Settings**, **General**, **About**, **Certificate Trust Settings**, and turn on **Hearth local certificate authority**.
4. Open `https://<your computer's IP>:3000` in Safari, sign in, tap **Share**, then **Add to Home Screen**.
5. Open Hearth from the Home Screen, go to **Settings**, **Alerts**, and turn on **Alerts on this device**. Alerts on iPhone only work from the Home Screen app.

**Android**

1. In Chrome, open `https://<your computer's IP>:3000/hearth-ca.crt` and download it.
2. Open **Settings**, **Security**, **Encryption and credentials**, **Install a certificate**, **CA certificate**, and choose the file.
3. Open `https://<your computer's IP>:3000`, sign in, choose **Install app** from the menu, then turn on alerts in **Settings**.

**Good to know**

- Keep `certs/hearth-ca.key` private: anyone with it could make certificates your phone trusts. Delete the `certs` folder to start over, then trust the new authority on each phone.
- If the computer's IP changes, run `npm run dev:https` again; the certificate is reissued for the new address, and phones keep trusting it. Use `HEARTH_HOSTS=hearth.lan,192.168.1.50 npm run dev:https` to add names or addresses of your own.
- If the phone cannot connect at all, check that the computer's firewall lets `node` accept incoming connections.
- Alerts come from your Hearth server through Apple's or Google's push service, so the server must be running and online.

## For a Hearth that runs all the time

A wall tablet or a phone away from home needs Hearth on a machine that stays on, with an address that works everywhere.

- **Tailscale** (simplest): install Tailscale on the Hearth machine and your phones, then run `tailscale serve --bg 3000`. Hearth gets `https://<machine>.<tailnet>.ts.net`, with a real certificate no phone needs to be told to trust, reachable only by your own devices. Add that address to `TRUSTED_ORIGINS`.
- **Your own domain**: put Caddy in front of Hearth (`reverse_proxy hearth:3000`) and it fetches a real certificate automatically. Only expose Hearth to the internet with sign-up turned off (`DISABLE_SIGNUP=true`) once your accounts exist.
