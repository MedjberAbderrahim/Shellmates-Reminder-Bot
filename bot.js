const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const crypto = require('crypto'); // For generating unique meeting IDs

function scheduleReminder(meetingId) {
    // meeting = {
    //      meetingDate,    // A date Object storing the date and time of the meeting
    //      details,
    //      comment,
    //      guildId,        // (guildId != null) If message came from server, null if came from DM or Group DM
    //      channelId       // ChannelID field of the interaction or message
    //  }
    const now = Date.now(); // Use a timestamp for consistency
    let meeting = meetings[meetingId]; // Ensure this is defined and valid

    const reminderTimes = [
        meeting.meetingDate.getTime() - 30 * 60 * 1000, // 30 minutes before
        meeting.meetingDate.getTime()                   // At the time of the meeting
    ];

    reminderTimes.forEach((reminderTime) => {
        if (reminderTime > now) {
            const delay = reminderTime - now;
            console.log(`Scheduling reminder for ${new Date(reminderTime).toString()}`);
            // setTimeout(() => sendReminder(meetingId, meeting), delay);
        }
    });
}

function sendReminder(meetingId) {
    const meeting = meetings[meetingId];

    if (!meeting) {
        console.error(`Meeting with ID ${meetingId} not found.`);
        return;
    }

    const { meetingDate, details, comment, guildId, channelId } = meeting;

    const formattedDate = meetingDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    const formattedTime = meetingDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });

    const embed = new EmbedBuilder()
        .setAuthor({ name: 'Shellmates Reminder App' })
        .setTitle('🔔 Meeting Reminder')
        .setDescription(
            `You have a meeting scheduled on **${formattedDate}** at **${formattedTime}**.\n\n**Details:** ${details}\n**Comment:** ${comment}`
        )
        .setTimestamp()
        .setFooter({ text: 'Reminder system' });

    const channel = client.channels.cache.get(channelId);
    console.log('channel: ' + channel.id)
    client.channels.fetch(channelId).then((channel) => {
        channel.send({ embeds: [embed] }).catch((error) => {
            console.error(`Failed to send reminder to channel ${channelId}:`, error);
        });
    })

    if (channel) {
        channel.send({ embeds: [embed] }).catch((error) => {
            console.error(`Failed to send reminder to channel ${channelId}:`, error);
        });
    }
    // else if (!guildId) {
    //     // If no guildId, send a DM to the user (optional)
    //     const user = client.users.cache.get(channelId); // channelId serves as userId for DMs
    //     if (user) {
    //         user.send({ embeds: [embed] }).catch((error) => {
    //             console.error(`Failed to send DM to user ${channelId}:`, error);
    //         });
    //     }
    //     else {
    //         console.error(`User with ID ${channelId} not found.`);
    //     }
    // }
    else {
        console.error(`Channel with ID ${channelId} not found.`);
    }
}
// function sendReminder(meetingId) {
//     // meeting = {
//     //      meetingDate,    // A date Object storing the date and time of the meeting
//     //      details,
//     //      comment,
//     //      guildId,        // (guildId != null) If message came from server, null if came from DM or Group DM
//     //      channelId       // ChannelID field of the interaction or message
//     //  }
//     let meeting = meetings[meetingId];
//     const embed = new EmbedBuilder()
//         .setAuthor({ name: 'Shellmates Reminder App' })
//         .setTitle('🔔 Meeting Reminder')
//         .setDescription(`You have a meeting scheduled on **${meeting.date}** at **${meeting.time}**. Details: **${meeting.details}**. Comment: **${meeting.comment}**.`)
//         .setTimestamp()
//         .setFooter({ text: 'Reminder system' });
//
//     switch (meeting.meetingType) {
//         case 1:
//             client.guilds.fetch(meeting.receiverID).then((guild) => {
//                 guild.members.fetch().then((members) =>
//                     members.forEach((member) =>
//                         member.send({ embeds: [embed] })
//                             .catch((err) => console.error(`Could not send to ${member.user.tag}: ${err}`))
//                     )
//                 )
//             }).catch((err) => console.error(`Could not fetch guild: ${err}`));
//             break;
//
//         case 2:
//             client.channels.fetch(meeting.receiverID).then((channel) => {
//                 channel.send({ embeds: [embed] })
//                     .catch((err) => console.error(`Could not send to the channel: ${err}`));
//             }).catch((err) => console.error(`Could not fetch channel: ${err}`));
//             break;
//
//         default:
//             console.error("Invalid meetingType field in object: ")
//             console.error(meeting);
//
//             break;
//     }
//
//     // if (!deleteMeeting(meetingId))
//     //     console.error(`Couldn't delete meeting of ID ${meetingId}`)
// }

function deleteMeeting(meetingID) {
    if (!meetings[meetingID])
        return false;

    delete meetings[meetingID];
    return true;
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
    ],
    partials: ['CHANNEL'],
});

const TOKEN = 'MTMyMjIxOTIwNzI4NjMyNTI5OQ.G30yQv.GJRwN_VEOBFgS6OP2WVWvY1rBY-hBESqgFAFj8'; // Replace with your bot's token
const PREFIX = '!'; // The prefix for the commands
let adminRoleId = null; // Variable to store the selected admin role
let meetings = {}; // To store meetings

client.once('ready', () => {
    console.log(`${client.user.tag} is ready to work!`);

    const commands = [
        new SlashCommandBuilder()
            .setName('addmeeting')
            .setDescription('Schedule a new meeting')
            .addStringOption(option =>
                option.setName('date')
                    .setDescription('The date for the meeting (DD-MM-YYYY or DD/MM/YYYY)')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option.setName('time')
                    .setDescription('The time for the meeting (HH:MM)')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option.setName('details')
                    .setDescription('Details of the meeting')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option.setName('comment')
                    .setDescription('Comment about the meeting')
                    .setRequired(true)
            ),
        new SlashCommandBuilder()
            .setName('meetings')
            .setDescription('Show all scheduled meetings'),
        new SlashCommandBuilder()
            .setName('removemeeting')
            .setDescription('Remove a scheduled meeting by its ID')
            .addStringOption(option =>
                option.setName('id')
                    .setDescription('ID of the meeting to remove')
                    .setRequired(true)
            ),
        new SlashCommandBuilder()
            .setName('selectrole')
            .setDescription('Select a role to manage meetings (only server owner can use this)')
            .addRoleOption(option =>
                option.setName('role')
                    .setDescription('The role to select for managing meetings')
                    .setRequired(true)
            ),
        new SlashCommandBuilder()
            .setName('removerole')
            .setDescription('Remove the selected admin role (only server owner can use this)'),
        new SlashCommandBuilder()
            .setName('help')
            .setDescription('Show a list of available commands and their usage'),
    ];

    // Trying to register commands globally, but it may take more time
    client.application.commands.set(commands)
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return; // Don't reply to bot messages

    if (!message.content.startsWith(PREFIX)) {
        return
    }

    // Handle prefix commands
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    switch (command) {
        case 'addmeeting': {
            // if (!adminRoleId || !message.member.roles.cache.has(adminRoleId)) {
            //     return message.reply('❌ You do not have permission to schedule meetings.');
            // }

            const date = args[0];
            const time = args[1];
            const details = args.slice(2, args.length - 1).join(' '); // Meeting details
            const comment = args[args.length - 1]; // Comment

            // Validate date, time, details, and comment
            if (!date || !time || !details || !comment) {
                return message.reply('❌ Please provide a valid date, time, details, and comment.');
            }

            const formattedDate = date.replace(/[^0-9]/g, '-'); // Format date
            const [day, month, year] = formattedDate.split('-');
            const meetingDate = new Date(`${year}-${month}-${day}T${time}:00`);

            if (isNaN(meetingDate)) {
                return message.reply('❌ Invalid date or time format.');
            }

            const now = new Date();
            if (meetingDate <= now) {
                return message.reply('❌ You cannot schedule a meeting in the past.');
            }

            let meetingType = null
            let receiverID = null

            if (message.guild) {
                meetingType = 1
                receiverID = message.guild.id
            }
            else if (message.channel.type === 'GROUP_DM') {
                meetingType = 2
                receiverID = message.channel.id
            }
            else {
                // Suppose it is a DM then
                meetingType = 3
                receiverID = message.author.id
            }

            const meetingId = crypto.randomBytes(16).toString('hex');
            meetings[meetingId] = { date, time, details, comment, meetingDate, meetingType, receiverID };
            scheduleReminder(meetingId)

            // Send confirmation message
            message.reply(`✅ Meeting scheduled for **${date}** at **${time}** with details: **${details}**. Comment: **${comment}**. Meeting ID: **${meetingId}**`);
            break;
        }

        case 'removemeeting': {
            if (deleteMeeting(args[0]))
                message.reply(`✅ Meeting with ID **${args[0]}** has been removed.`);
            else
                return message.reply(`❌ No meeting found with ID **${args[0]}**.`);

            break;
        }

        case 'selectrole':
            if (message.author.id !== message.guild.ownerId) {
                return message.reply('❌ Only the server owner can select the admin role.');
            }

            const role = message.mentions.roles.first();
            if (!role) {
                return message.reply('❌ Please mention a role to select.');
            }

            adminRoleId = role.id;
            message.reply(`✅ Role **${role.name}** has been selected as the admin role.`);
            break;

        case 'meetings':
            console.log('message = ');
            console.log(message)

            if (Object.keys(meetings).length === 0) {
                return message.reply('There are no meetings currently scheduled.');
            }


            let msg1 = '📅 Upcoming Meetings:\n';
            let displayedMeetings = ""

            if (message.guild) {    // Server Message
                Object.keys(meetings).forEach((meetingId) => {
                    const meeting = meetings[meetingId];
                    if(meeting.meetingType === 1 && meeting.receiverID === message.guild.id)
                        displayedMeetings += `**ID**: ${meetingId} | **Date**: ${meeting.date} | **Time**: ${meeting.time} | **Details**: ${meeting.details} | **Comment**: ${meeting.comment}\n`;
                });
            }
            else if (message.channel.type === 'GROUP_DM') { // Group DM Message
                Object.keys(meetings).forEach((meetingId) => {
                    const meeting = meetings[meetingId];
                    if(meeting.meetingType === 2 && meeting.receiverID === message.channel.id)
                        displayedMeetings += `**ID**: ${meetingId} | **Date**: ${meeting.date} | **Time**: ${meeting.time} | **Details**: ${meeting.details} | **Comment**: ${meeting.comment}\n`;
                });
            }
            else {
                // Suppose it is a DM then
                Object.keys(meetings).forEach((meetingId) => {
                    const meeting = meetings[meetingId];
                    if(meeting.meetingType === 3 && meeting.receiverID === message.author.id)
                        displayedMeetings += `**ID**: ${meetingId} | **Date**: ${meeting.date} | **Time**: ${meeting.time} | **Details**: ${meeting.details} | **Comment**: ${meeting.comment}\n`;
                });
            }

            if (displayedMeetings === "")
                return message.reply('There are no meetings currently scheduled.');
            else
                message.reply(msg1 + displayedMeetings);

            break;

        case 'removerole':
            if (message.author.id !== message.guild.ownerId) {
                return message.reply('❌ Only the server owner can remove the admin role.');
            }

            adminRoleId = null;
            message.reply('✅ Admin role has been removed.');
            break;
        case 'help':
            const helpEmbed = new EmbedBuilder()
                .setColor(0x0099ff)
                .setTitle('Shellmates Meeting Bot - Help')
                .setDescription('Here are the commands you can use:')
                .addFields(
                    { name: '!addmeeting', value: 'Schedule a new meeting.' },
                    { name: '!meetings', value: 'View all scheduled meetings.' },
                    { name: '!removemeeting', value: 'Remove a scheduled meeting by its ID.' },
                    { name: '!selectrole', value: 'Set the role that can manage meetings.' },
                    { name: '!removerole', value: 'Remove the selected admin role.' }
                )
                .setTimestamp()
                .setFooter({ text: 'Created by Shellmates' });

            message.reply({ embeds: [helpEmbed] });
            break;

        default:
            message.reply('Invalid Command!')
            break;
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName, options, user } = interaction;

    // Handle /addmeeting (slash command)
    if (commandName === 'addmeeting') {
        // if (!interaction.member.roles.cache.has(adminRoleId)) {
        //     return interaction.reply('❌ You do not have permission to schedule meetings.');
        // }

        const date = options.getString('date');
        const time = options.getString('time');
        const details = options.getString('details');
        const comment = options.getString('comment');

        const formattedDate = date.replace(/[^0-9]/g, '-');
        const [day, month, year] = formattedDate.split('-');
        const meetingDate = new Date(`${year}-${month}-${day}T${time}:00`);

        if (isNaN(meetingDate)) {
            return interaction.reply('❌ Invalid date or time format.');
        }

        const now = new Date();
        if (meetingDate <= now) {
            return interaction.reply('❌ You cannot schedule a meeting in the past.');
        }

        let guildId = interaction.guildId // null if message came from DM or group DM
        let channelId= interaction.channelId

        const meetingId = crypto.randomBytes(16).toString('hex');
        meetings[meetingId] = { meetingDate, details, comment, guildId, channelId };
        scheduleReminder(meetingId)

        await interaction.reply(`✅ Meeting scheduled for **${date}** at **${time}** with details: **${details}**. Comment: **${comment}**. Meeting ID: **${meetingId}**`);
    }

    // Handle /meetings (slash command)
    if (commandName === 'meetings') {
        console.log('interaction = ');
        console.log(interaction)

        if (Object.keys(meetings).length === 0) {
            return interaction.reply('There are no meetings currently scheduled.');
        }


        let msg1 = '📅 Upcoming Meetings:\n';
        let displayedMeetings = ""

        if (interaction.guild) {    // Server interaction
            Object.keys(meetings).forEach((meetingId) => {
                const meeting = meetings[meetingId];
                if(meeting.meetingType === 1 && meeting.receiverID === interaction.guild.id)
                    displayedMeetings += `**ID**: ${meetingId} | **Date**: ${meeting.date} | **Time**: ${meeting.time} | **Details**: ${meeting.details} | **Comment**: ${meeting.comment}\n`;
            });
        }
        else if (interaction.channel.type === 'GROUP_DM') { // Group DM interaction
            Object.keys(meetings).forEach((meetingId) => {
                const meeting = meetings[meetingId];
                if(meeting.meetingType === 2 && meeting.receiverID === interaction.channel.id)
                    displayedMeetings += `**ID**: ${meetingId} | **Date**: ${meeting.date} | **Time**: ${meeting.time} | **Details**: ${meeting.details} | **Comment**: ${meeting.comment}\n`;
            });
        }
        else {
            // Suppose it is a DM then
            Object.keys(meetings).forEach((meetingId) => {
                const meeting = meetings[meetingId];
                if(meeting.meetingType === 3 && meeting.receiverID === interaction.author.id)
                    displayedMeetings += `**ID**: ${meetingId} | **Date**: ${meeting.date} | **Time**: ${meeting.time} | **Details**: ${meeting.details} | **Comment**: ${meeting.comment}\n`;
            });
        }

        if (displayedMeetings === "")
            return interaction.reply('There are no meetings currently scheduled.');
        else
            interaction.reply(msg1 + displayedMeetings);
    }

    // Handle /removemeeting (slash command)
    if (commandName === 'removemeeting') {
        const meetingId = options.getString('id');
        if (!meetings[meetingId]) {
            return interaction.reply('❌ No meeting found with that ID.');
        }

        delete meetings[meetingId];
        await interaction.reply(`✅ Meeting with ID **${meetingId}** has been removed.`);
    }

    // Handle /selectrole (slash command)
    if (commandName === 'selectrole') {
        if (user.id !== interaction.guild.ownerId) {
            return interaction.reply('❌ Only the server owner can select the admin role.');
        }

        const role = options.getRole('role');
        adminRoleId = role.id;
        await interaction.reply(`✅ Role **${role.name}** has been selected as the admin role.`);
    }

    // Handle /removerole (slash command)
    if (commandName === 'removerole') {
        if (user.id !== interaction.guild.ownerId) {
            return interaction.reply('❌ Only the server owner can remove the admin role.');
        }

        adminRoleId = null;
        await interaction.reply('✅ Admin role has been removed.');
    }

    // Handle /help (slash command)
    if (commandName === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle('Shellmates Meeting Bot - Help')
            .setDescription('Here are the commands you can use:')
            .addFields(
                { name: '/addmeeting', value: 'Schedule a new meeting.' },
                { name: '/meetings', value: 'View all scheduled meetings.' },
                { name: '/removemeeting', value: 'Remove a scheduled meeting by its ID.' },
                { name: '/selectrole', value: 'Set the role that can manage meetings.' },
                { name: '/removerole', value: 'Remove the selected admin role.' }
            )
            .setTimestamp()
            .setFooter({ text: 'Created by Shellmates' });

        await interaction.reply({ embeds: [helpEmbed] });
    }
});

client.login(TOKEN);