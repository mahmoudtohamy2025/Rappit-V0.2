import { IsString, IsNotEmpty } from 'class-validator';

export class AddOrderNoteDto {
  @IsString()
  @IsNotEmpty()
  note: string;
}
