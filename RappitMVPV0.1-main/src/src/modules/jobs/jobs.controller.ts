import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';

@ApiTags('Jobs')
@Controller('jobs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class JobsController {
  constructor(private jobsService: JobsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get all queue statistics' })
  async getAllStats() {
    return this.jobsService.getAllQueueStats();
  }

  @Get(':queue/stats')
  @ApiOperation({ summary: 'Get queue statistics' })
  async getStats(@Param('queue') queue: string) {
    return this.jobsService.getQueueStats(queue);
  }

  @Get(':queue/:jobId')
  @ApiOperation({ summary: 'Get job status' })
  async getJobStatus(
    @Param('queue') queue: string,
    @Param('jobId') jobId: string,
  ) {
    return this.jobsService.getJobStatus(queue, jobId);
  }
}
