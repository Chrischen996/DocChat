// 测试Doubao-Seedance-1.0-lite-t2v模型
const API_KEY = process.env.ARK_API_KEY;

if (!API_KEY) {
  console.error('请设置ARK_API_KEY环境变量');
  process.exit(1);
}

const API_URL = 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks';

async function testDoubaoLite() {
  console.log('🧪 测试Doubao-Seedance-1.0-lite-t2v模型...');
  
  const requestBody = {
    model: 'doubao-seedance-1-0-lite-t2v-250428',
    content: [
      {
        type: 'text',
        text: '写实风格，晴朗的蓝天之下，一大片白色的雏菊花田，镜头逐渐拉近，最终定格在一朵雏菊花的特写上，花瓣上有几颗晶莹的露珠  --ratio 16:9 --resolution 720p  --duration 5 --camerafixed false --watermark true'
      }
    ]
  };

  console.log('📤 请求体:', JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📥 响应状态:', response.status);
    
    if (!response.ok) {
      const error = await response.text();
      console.error('❌ 请求失败:', error);
      return;
    }

    const result = await response.json();
    console.log('✅ 请求成功:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ 请求异常:', error.message);
  }
}

testDoubaoLite();