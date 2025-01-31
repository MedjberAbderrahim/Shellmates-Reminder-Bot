const { Client, GatewayIntentBits } = require('discord.js');

const TOKEN = ''        // INSERT KEY HERE
const guildId = '';     // INSERT GUILD ID HERE

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    const guild = await client.guilds.fetch(guildId);

    const commands = await guild.commands.fetch();

    console.log('Existing Slash Commands:', commands.map(cmd => cmd.name));

    // Delete specific deprecated commands
    for (const command of commands.values()) {
        await guild.commands.delete(command.id);
        console.log(`Deleted command: ${command.name}`);
    }

    // For global commands (if needed)
    const globalCommands = await client.application.commands.fetch();
    for (const command of globalCommands.values()) {
        await client.application.commands.delete(command.id);
        console.log(`Deleted global command: ${command.name}`);
    }

    console.log('Cleanup complete.');

// ------------------------------------------------------------------------------------------------
// FOR CHECKING COMMANDS
    // console.log('Global commands:')
    // let commands = await client.application.commands.fetch();
    // for (const [, command] of commands) { // Destructure to get only the value
    //     console.log(command.name);
    // }
    // for (let i = 0; i < 3; i++)
    //     console.log('---------------------------------------------------------------------')
    //
    // console.log('Guild-specific commands:')
    // commands = await guild.commands.fetch()
    // for (const [, command] of commands) { // Destructure to get only the value
    //     console.log(command.name);
    // }


    process.exit();
});

client.login(TOKEN);