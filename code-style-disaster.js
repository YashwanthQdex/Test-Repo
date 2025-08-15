// Code Style Disaster - Poor formatting and naming
const fs=require('fs');
const path=require('path');

// Inconsistent indentation
function badIndentation(){
let x=5;
  let y=10;
    let z=15;
return x+y+z;
}

// Poor variable naming
function processData(data){
const a=data.length;
const b=data.filter(x=>x>0);
const c=b.map(x=>x*2);
return c;
}

// Inconsistent spacing
function inconsistentSpacing( param1,param2 ){
const result=param1+param2;
return result;
}

// Mixed naming conventions
function getUserData(userId){
const user_name="John";
const userAge=25;
const user_email="john@example.com";
const UserRole="admin";
return {user_name,userAge,user_email,UserRole};
}

// Long lines without proper formatting
function longLineFunction(param1,param2,param3,param4,param5,param6,param7,param8,param9,param10){
return param1+param2+param3+param4+param5+param6+param7+param8+param9+param10;
}

// Inconsistent quote usage
function mixedQuotes(){
const str1="Hello";
const str2='World';
const str3=`Hello ${str2}`;
return str1+str2+str3;
}

// Poor function naming
function doStuff(input){
// Function name doesn't describe what it does
const result=input*2;
return result;
}

// Inconsistent bracing style
function inconsistentBraces()
{
if(true){
console.log("True");
}else{
console.log("False");
}
}

// Magic numbers
function calculateTax(amount){
return amount*0.15; // Magic number without explanation
}

// Deep nesting without proper structure
function deeplyNested(){
if(condition1){
if(condition2){
if(condition3){
if(condition4){
if(condition5){
console.log("Too deep!");
}
}
}
}
}
}

// Inconsistent return statements
function inconsistentReturns(value){
if(value>0){
return value*2;
}else if(value<0){
return value*-1;
}else{
return 0;
}
}

// Poor comment style
// this is a bad comment
function badComment(){
//do something
const x=5;
return x;
}

// Inconsistent array/object formatting
function inconsistentFormatting(){
const arr=[1,2,3,4,5];
const obj={name:"John",age:25,city:"NYC"};
return {arr,obj};
}

// Unused parameters
function unusedParams(param1,param2,param3){
// param2 and param3 are never used
return param1*2;
}

// Inconsistent semicolon usage
let x=5
let y=10;
let z=15

// Poor error handling style
function badErrorHandling(){
try{
riskyOperation();
}catch(e){
console.log("Error:"+e);
}
}

// Inconsistent method chaining
function badMethodChaining(){
const result="hello world"
.toUpperCase()
.split(" ")
.join("-");
return result;
}

// Poor conditional formatting
function badConditionals(){
if(condition1&&condition2||condition3){
console.log("Complex condition");
}
}

// Inconsistent async/await usage
async function inconsistentAsync(){
const data=await fetchData();
const processed=data.map(x=>x*2);
return processed;
}

// Poor destructuring
function badDestructuring(obj){
const a=obj.a;
const b=obj.b;
const c=obj.c;
return a+b+c;
}

module.exports={
badIndentation,
inconsistentSpacing,
getUserData,
longLineFunction,
mixedQuotes,
doStuff,
inconsistentBraces,
calculateTax,
deeplyNested,
inconsistentReturns,
badComment,
inconsistentFormatting,
unusedParams,
badErrorHandling,
badMethodChaining,
badConditionals,
inconsistentAsync,
badDestructuring
};
