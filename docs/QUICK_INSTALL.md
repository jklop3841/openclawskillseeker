# Quick Install

This is the shortest path for a normal user.

## 1. Download

Download the latest installer from GitHub Release:

- `OpenClaw-Exoskeleton-Setup.exe`

## 2. Install

Double-click the installer.

It will:

- extract the desktop app
- create desktop and start menu shortcuts
- open `OpenClaw Exoskeleton`

## 3. Open the app

When the app opens, start with the environment guidance at the top of the page.

Then use one of these paths:

- `I already have OpenClaw / ClawX`
- `I have OpenClaw, but I still need clawhub`
- `I still need OpenClaw / ClawX`

## 4. Fastest safe test

If your environment is ready:

1. Click `Install and attach Calendar`
2. Wait for the result
3. Restart OpenClaw
4. Test the skill inside OpenClaw

Suggested test prompt:

```text
Please check whether the calendar skill is loaded. If it is, use it to review today's schedule.
```

## 5. Managed library path

If you want a cleaner long-term setup, use the managed library section instead:

1. Search the library
2. Enable one managed pack or one managed skill
3. Restart OpenClaw
4. Keep the active set small

## 6. If something fails

The app will tell you which category you hit:

- OpenClaw not detected
- clawhub not detected
- verify did not pass
- registry install needs retry

You should not need to manually edit `openclaw.json` for the normal path.
