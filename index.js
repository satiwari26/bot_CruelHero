const express = require("express");
const app = express();
const axios = require("axios");

//env tokens to include the api in the applciation
require('dotenv').config();
const discord_token = process.env.DISCORD_TOKEN;
const canvasToken = process.env.CANVAS_TOKEN;

app.listen(3000, ()=>{
    console.log("Bot is running");
});

app.get("/", (req,res)=>{
    res.send("hello world! This is bot_CruelHero.");
})

const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]});
client.on("messageCreate", async message =>{
    if(message.author.id !== '1153450960614588456'){    //so it doesn't record it's own response
        // console.log(message);
        let startStr = -1;
        for(let i=0;i<message.content.length;i++){  //get the staring position where @ tag ends, time complex O(n)
            if(message.content[i] === ">"){
                startStr = i;
            }
        }
        let messageVal = (message.content.substring(startStr + 2, message.content.length)).toLowerCase();
        const profanityList = ["shit", "fuck", "suck", "dick", "pussy", "cum"]; //to make the chat pg-13
        for(let i=0;i<profanityList.length;i++){
            if(messageVal.includes(profanityList[i])){
                message.channel.send(" Bro, Please maintain the integrity of this server. \n ** if you have issues with me contact Drew T. **");
                break;
            }
        }

        const canvasTasksPrompt = ["assignments due today", "upcoming quizzes"];

        if(canvasTasksPrompt.includes(messageVal) && messageVal === "assignments due today"){
            const task = new CanvasTasks();
            //assignmentsListDueToday is a async function so we have to wait until the promise is resolved
            const list = await task.assignmentsListDueToday();
            message.channel.send(`**Dawgg, you have following assignments due today** \n`);
            for(let i=0; i<list.length; i++){
                message.channel.send(`**CourseName:** ${list[i].courseName} **assignmentName:** ${list[i].assingmentName} **Due at:** ${list[i].time}`);
            }
        }
        if(canvasTasksPrompt.includes(messageVal) && messageVal === "upcoming quizzes"){
            const task = new CanvasTasks();
            const taskList = await task.upcomingQuizez();

            message.channel.send(`**Bro, you have following upcoming quizzes:** \n`);
            for(let i=0; i<taskList.length; i++){
                message.channel.send(`**CourseName: ** ${taskList[i].courseName}     **QuizTitle: ** ${taskList[i].title}     **Due at: ** ${taskList[i].all_dates[0].due_at}     **unlocks at: ** ${taskList[i].all_dates[0].unlock_at}    **lock_at: ** ${taskList[i].all_dates[0].lock_at} \n \n`);
            }
        }
    }
});

//canvas task class, based on the different task would help us identify what kind of task we are dealing with
class CanvasTasks{
    constructor(){
        //store the todays date for the future reference
        const currentLocalDate = new Date();
        this.dateString = currentLocalDate.toISOString();
        this.todaysDate = this.dateString.substring(0,10);
        console.log(this.todaysDate);

        //empty courses field, as soon as instance of this field gets assigned we want to have this field fill first
        this.courseLists = [];
    }

    //since the assignment dueDate function depends on the updateCourseList function we can call it inside another function,
    //and wait till promise has been resolved and updateCourseList function is done executing. after that we can call the AssignmentsDueToday
    //function.

    async assignmentsListDueToday(){
        await this.updateCourseList();
        const assignmentList = await this.AssignmentsDueToday();
        // console.log(assignmentList);
        return assignmentList;
    }

    async upcomingQuizez(){ //genearates the list of upcoming quizzes
        await this.updateCourseList();
        const quizList = await this.upcomingQuizList();
        // console.log(quizList);
        return quizList
    }

    async upcomingQuizList(){
        const quizList = [];
        const responses = [];
        const validCourseIndex = [];    //to keep track of which course index we are using, cuz we are filtering courses out by dates

        for(let i=0;i<this.courseLists.length;i++){
            if(this.courseLists[i].created_at.substring(0,10) > "2023-05-12"){
                const url = `https://canvas.calpoly.edu/api/v1/courses/${this.courseLists[i].courseID}/quizzes`;
                validCourseIndex.push(i);
                responses.push(await axios.get(url, {
                    headers: {
                        Authorization: `Bearer ${canvasToken}`,
                    },
                }));
            }
        }
        try{
            for(let i=0;i<responses.length;i++){
                const res = responses[i];
                if(res.data.length > 0){
                    for(let j=0;j<res.data.length;j++){
                        const quizObj = {courseName: this.courseLists[validCourseIndex[i]].courseName, title: res.data[j].title, all_dates: res.data[j].all_dates};
                        quizList.push(quizObj);
                    }
                }
            }
            // console.log(quizList);
            return quizList;
        }
        catch(error){
            console.log(error);
        }
    }

    async updateCourseList(){
        const url = 'https://canvas.calpoly.edu/api/v1/courses';
        try{
            const response = await axios.get(url, {
                headers: {
                    Authorization: `Bearer ${canvasToken}`,
                },
            });
            //it will wait till the promise has been resolved and then move on to update the field
            for(let i=0;i<response.data.length;i++){
                if(response.data[i].access_restricted_by_date !== true){
                    const currObject = { courseID: response.data[i].id, courseName: response.data[i].name, created_at: response.data[i].created_at };
                    this.courseLists.push(currObject);
                }
            }
        }
        catch(error){
            console.log(error);
        }
    }

    async AssignmentsDueToday(){
        const assignmentList = [];  //to keep track of the due assignments today
        const responses = [];  //since we are making multiple ajax call, we need to keep track of all of them and 
        //execute the remaning code after all the promises has been resolved.


        //get the current date and match it with the assignment date to see if it is due today or not
        for(let i=0;i<this.courseLists.length;i++){
            const url = `https://canvas.calpoly.edu/api/v1/courses/${this.courseLists[i].courseID}/assignments`;
            responses.push(await axios.get(url, {
                headers: {
                    Authorization: `Bearer ${canvasToken}`,
                },
            }));
        }
        //we get response list for all the resolved promises
        try{
            for(let j=0;j<responses.length;j++){
                const res = responses[j];
                for(let i=0; i<res.data.length;i++){
                    const dueDate = res.data[i].due_at;
                    if(dueDate !== null && "2023-04-15" === (dueDate.substring(0,10))){    //if todays date matches with the assignment due date
                        const dueAssignment = {courseName: this.courseLists[j].courseName, assingmentName: res.data[i].name, time: dueDate.substring(10,dueDate.length)}
                        assignmentList.push(dueAssignment);
                    }
                }
            }
            return(assignmentList);
        }
        catch(error){
            console.log(error);
        }
    }
}

client.login(discord_token);