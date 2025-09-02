// 豆包API测试脚本
// 使用方法: node test-doubao-api.js YOUR_API_KEY

const API_KEY = process.argv[2];

if (!API_KEY) {
  console.error('请提供API密钥: node test-doubao-api.js YOUR_API_KEY');
  process.exit(1);
}

const API_URL = 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks';

// 测试文本转视频
async function testTextToVideo() {
  console.log('🎬 测试文本转视频...');
  
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: 'doubao-seedance-1-0-lite-i2v-250428',
      content: [
        {
          type: 'text',
          text: '天空的云飘动着，路上的车辆行驶 --resolution 720p --duration 5 --camerafixed false --watermark true'
        }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }

  const result = await response.json();
  console.log('✅ 任务创建成功:', {
    taskId: result.id,
    status: result.status
  });

  if (result.id) {
    return await pollTaskStatus(result.id);
  }

  return result;
}

// 测试图片转视频
async function testImageToVideo() {
  console.log('🖼️ 测试图片转视频...');
  
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: 'doubao-seedance-1-0-lite-i2v-250428',
      content: [
        {
          type: 'text',
          text: '动漫女孩在樱花飞舞的花园中跳舞 --resolution 720p --duration 5 --camerafixed false --watermark true'
        },
        {
          type: 'image_url',
          image_url: {
            url: 'https://ark-project.tos-cn-beijing.volces.com/doc_image/see_i2v.jpeg'
          }
        }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }

  const result = await response.json();
  console.log('✅ 任务创建成功:', {
    taskId: result.id,
    status: result.status
  });

  if (result.id) {
    return await pollTaskStatus(result.id);
  }

  return result;
}

// 轮询任务状态
async function pollTaskStatus(taskId, maxAttempts = 30) {
  console.log(`⏳ 开始轮询任务状态: ${taskId}`);
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(`${API_URL}/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      console.warn(`⚠️ 获取状态失败 (尝试 ${attempt + 1}/${maxAttempts}):`, error);
      await new Promise(resolve => setTimeout(resolve, 5000));
      continue;
    }

    const result = await response.json();
    console.log(`📊 任务状态 (尝试 ${attempt + 1}/${maxAttempts}):`, {
      status: result.status,
      progress: result.progress || 'N/A'
    });

    if (result.status === 'succeeded') {
      console.log('🎉 任务完成成功!');
      console.log('📹 视频URL:', result.result?.video_url || '未获取到视频URL');
      return result;
    } else if (result.status === 'failed') {
      throw new Error(`❌ 任务失败: ${result.error || '未知错误'}`);
    }

    // 等待10秒后重试
    await new Promise(resolve => setTimeout(resolve, 10000));
  }

  throw new Error('⏰ 任务轮询超时 - 达到最大重试次数');
}

// 主函数
async function main() {
  try {
    console.log('🚀 开始测试豆包API集成...\n');

    // 测试文本转视频
    const textResult = await testTextToVideo();
    console.log('\n📝 文本转视频测试结果:', {
      success: true,
      videoUrl: textResult.result?.video_url || textResult.video_url
    });

    console.log('\n' + '='.repeat(50) + '\n');

    // 测试图片转视频
    const imageResult = await testImageToVideo();
    console.log('\n🖼️ 图片转视频测试结果:', {
      success: true,
      videoUrl: imageResult.result?.video_url || imageResult.video_url
    });

    console.log('\n✅ 所有测试完成！豆包API集成正常工作。');

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    process.exit(1);
  }
}

// 运行测试
main();
