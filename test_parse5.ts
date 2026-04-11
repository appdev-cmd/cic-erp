const content = `<|tool_call|>
call:get_comprehensive_report{year:<|">2025<|">}
<|tool_call|>`;

const regex = /<\|tool_call\|>(.*?)(<\|\/?tool_call\|>|$)/g;
console.log(regex.exec(content));

const regex_s = /<\|tool_call\|>(.*?)(<\|\/?tool_call\|>|$)/gs;
console.log(regex_s.exec(content));
