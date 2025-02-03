# Shellmates Reminder Bot

## Overview

Shellmates Reminder Bot is a comprehensive Discord bot designed to streamline meeting management and communication within Discord servers. With advanced features for scheduling, reminding, and permission management, this bot helps teams coordinate effectively and stay informed about upcoming meetings.

## Features

### Meeting Management
- Schedule meetings with detailed information
- Set custom reminder times
- Mention specific users or roles in meeting reminders
- View all scheduled meetings
- Remove meetings manually
- Manually trigger meeting reminders

### Permissions System
- Granular command-level permissions
- Assign permissions to:
    - Individual users
    - Roles
    - Server-wide (@everyone)
- Add and remove permissions dynamically

### Notification System
- Visually appealing embedded messages
- Custom reminder intervals
- Automatic meeting deletion after the last reminder

## Prerequisites

- Node.js (v16.9.0 or newer)
- Discord Account
- Discord Developer Portal Application

## Installation

1. Clone the repository
```bash
git clone https://github.com/MedjberAbderrahim/Shellmates-Reminder-Bot.git
cd shellmates-meeting-bot
```

2. Install dependencies
```bash
npm install
```

3. Configure Bot
- Create a new application in the [Discord Developer Portal](https://discord.com/developers/applications)
- Generate a bot token
- Enable necessary intents
- Copy the bot token and guild ID into `bot.js`

4. Run the Bot
```bash
node bot.js
```

## Commands

### Meeting Commands
- `/add_meeting`: Schedule a new meeting
- `/meetings`: View all scheduled meetings
- `/remove_meeting`: Remove a scheduled meeting
- `/remind`: Manually send a meeting reminder

### Permission Commands
- `/add_permissions`: Grant command permissions
- `/remove_permissions`: Revoke command permissions
- `/help`: Display available commands

## Usage Example

```
/add_meeting details:"Project Sync" date:"2024-02-15" time:"14:30" tags:"@team-leads" custom_reminders:"30m 10m"
```

This command schedules a meeting, tags team leads, and sets reminders 30 and 10 minutes before the meeting.

## Permissions

The bot supports a flexible, role-based permissions system. Administrators can:
- Grant specific command access to users or roles
- Revoke permissions as needed
- Set server-wide default permissions

## Security

- Isolated meeting and permission management per server
- Secure mention resolution
- Role and user-based access control

## Contributing

Contributions are welcome! Available by forking/cloning the repository and submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For issues, feature requests, or questions, please [open an issue](https://github.com/MedjberAbderrahim/Shellmates-Reminder-Bot/issues) on GitHub.

---

Created by a team of university club [Shellmates](https://linktr.ee/shellmates).
